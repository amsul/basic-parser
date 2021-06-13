type Data = Record<string, number | string>

export interface Renderer<RenderedElement> {
  match: string | { start: string; end: string }
  renderMatch: (
    matchProps: RenderMatchProps<RenderedElement>,
  ) => RenderedElement
}

export interface NormalizedRenderer<RenderedElement>
  extends Renderer<RenderedElement> {
  regExpPart: string
  groupIndexes: number[]
}

export interface RenderMatchProps<RenderedElement> {
  key: string
  children: Array<string | RenderedElement>
  data?: Data
  startMatches: string[]
  endMatches: string[]
}

export default function createRenderer<RenderedElement>(
  renderers: Renderer<RenderedElement>[],
) {
  const normalizedRenderers = normalizeRenderers<RenderedElement>(renderers)
  return function renderer(text: string, data?: Data) {
    const parts = parse<RenderedElement>(normalizedRenderers, text)
    return render<RenderedElement>(parts, text, data)
  }
}

function normalizeRenderers<RenderedElement>(
  renderers: Renderer<RenderedElement>[],
): NormalizedRenderer<RenderedElement>[] {
  return renderers.reduce((accumulator, renderer, _index) => {
    const previousRenderer: NormalizedRenderer<RenderedElement> =
      accumulator[accumulator.length - 1]

    const previousLastGroupIndex = previousRenderer
      ? previousRenderer.groupIndexes[previousRenderer.groupIndexes.length - 1]
      : 0

    const { match } = renderer

    if (typeof match === 'string') {
      accumulator.push({
        ...renderer,
        regExpPart: match,
        groupIndexes: getGroupIndexes(match, previousLastGroupIndex),
      })
      return accumulator
    }

    const startGroupIndexes = getGroupIndexes(
      match.start,
      previousLastGroupIndex,
    )
    accumulator.push({
      ...renderer,
      regExpPart: match.start,
      groupIndexes: startGroupIndexes,
    })

    accumulator.push({
      ...renderer,
      regExpPart: match.end,
      groupIndexes: getGroupIndexes(
        match.end,
        previousLastGroupIndex,
        startGroupIndexes.length,
      ),
    })

    return accumulator
  }, [] as NormalizedRenderer<RenderedElement>[])
}

function getGroupIndexes(
  match: string,
  previousLastGroupIndex: number,
  shift: number = 0,
) {
  const newRegExp = new RegExp(match + '|')
  const result = newRegExp.exec('')
  if (!result) {
    throw new Error('Invalid regular expression')
  }
  return Array.from(new Array(result.length)).map(
    (_, index) => index + previousLastGroupIndex + 1 + shift,
  )
}

export type ParsingPart<RenderedElement> =
  | string
  | {
      element: RenderedElement
    }
  | {
      matches: string[]
      renderer: NormalizedRenderer<RenderedElement>
    }

function parse<RenderedElement>(
  renderers: NormalizedRenderer<RenderedElement>[],
  text: string,
): ParsingPart<RenderedElement>[] {
  const regExpParts = renderers.map(renderer => `(${renderer.regExpPart})`)
  const regExp = new RegExp(regExpParts.join('|'), 'gm')

  const parts: ParsingPart<RenderedElement>[] = []
  let lastIndex = 0
  let regExpResult: RegExpExecArray | null = null
  let safety = 1000

  while ((regExpResult = regExp.exec(text))) {
    if (!safety--) {
      console.error('Breaking early to avoid potential infinite loop')
      break
    }

    const beforeChunk = text.substring(lastIndex, regExpResult.index)
    lastIndex = regExp.lastIndex

    const isMatchEscaped = beforeChunk[beforeChunk.length - 1] === '\\'

    if (beforeChunk) {
      parts.push(isMatchEscaped ? beforeChunk.slice(0, -1) : beforeChunk)
    }

    if (isMatchEscaped) {
      parts.push(regExpResult.input[regExpResult.index])
      continue
    }

    renderers.some(renderer => {
      const isInSomeRendererGroup = renderer.groupIndexes.some(
        groupIndex => regExpResult![groupIndex] != null,
      )
      if (!isInSomeRendererGroup) {
        return false
      }
      const matches = regExpResult!
        .filter((_, index) => renderer.groupIndexes.includes(index))
        .slice(1)
      parts.push({ matches, renderer })
      return true
    })
  }

  const afterChunk = text.slice(lastIndex)
  if (afterChunk) {
    parts.push(afterChunk)
  }

  return parts
}

function render<RenderedElement>(
  parts: ParsingPart<RenderedElement>[],
  text: string,
  data?: Data,
): Array<string | RenderedElement> {
  const tree: Array<string | RenderedElement> = []
  let currentIndex = 0
  let safety = 1000

  while (parts.length) {
    if (!safety--) {
      console.error('Breaking early to avoid potential infinite loop')
      break
    }

    // If every item up to (and including) the current one is a string,
    // move the items from the parts to the tree.
    const isPlainString = parts
      .slice(0, currentIndex + 1)
      .every(item => typeof item === 'string')
    if (isPlainString) {
      const removedItems = parts.splice(0, currentIndex + 1) as string[]
      tree.push(...removedItems)
      currentIndex = 0
      continue
    }

    const currentPart = parts[currentIndex]
    if (
      typeof currentPart === 'string' ||
      'element' in currentPart ||
      !currentPart ||
      !currentPart.renderer ||
      !currentPart.renderer.renderMatch
    ) {
      console.error(
        'No renderer found for the matching part in %o at %o',
        parts,
        currentIndex,
      )
      break
    }

    // If there is no part closer for the current part, strip it out.
    const hasPartCloser = parts.some(
      part =>
        typeof part !== 'string' &&
        !('element' in part) &&
        part !== currentPart &&
        part &&
        part.renderer &&
        part.renderer.renderMatch === currentPart.renderer.renderMatch,
    )
    if (!hasPartCloser) {
      parts.splice(currentIndex, 1)
      currentIndex = 0
      continue
    }

    const nextPartIndex = parts.findIndex(
      (part, index) =>
        typeof part !== 'string' &&
        !('element' in part) &&
        index > currentIndex &&
        part &&
        part.renderer &&
        part.renderer.renderMatch,
    )
    const nextPart = parts[nextPartIndex]
    if (!nextPart || typeof nextPart === 'string' || 'element' in nextPart) {
      throw new Error(`Unable to render text: "${text}"`)
    }

    // If the next renderer is different, there is a nested renderer,
    // so move on to the next renderer's index.
    if (nextPart.renderer.renderMatch !== currentPart.renderer.renderMatch) {
      currentIndex = nextPartIndex
      continue
    }

    // Otherwise, there is no nested renderer,
    // so grab the children and matches to render the element.
    const element = nextPart.renderer.renderMatch({
      key: `${tree.length}:${currentIndex}:${nextPartIndex}`,
      children: parts
        .slice(currentIndex + 1, nextPartIndex)
        .map(part =>
          typeof part !== 'string' && 'element' in part ? part.element : part,
        ) as Array<string | RenderedElement>,
      data,
      startMatches: currentPart.matches,
      endMatches: nextPart.matches,
    })

    // If this is a nested renderer, splice the element's part down to the element.
    // Otherwise, remove the element's part and add the element to the tree.
    if (currentIndex !== 0) {
      parts.splice(currentIndex, nextPartIndex - currentIndex + 1, { element })
    } else {
      parts.splice(0, nextPartIndex + 1)
      tree.push(element)
    }

    // Start again from the start of the part
    currentIndex = 0
  }

  return tree
}
