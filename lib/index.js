// @flow

type RenderPropsType = {
  key: string,
  children: Array<*>,
  startMatches: string[],
  endMatches: string[],
}

type RendererType = {
  match: string | { start: string, end: string },
  render: RenderPropsType => any,
}

type ParserType = ({
  renderers: Array<RendererType>
}) => ({ data?: Object, text: string }) => mixed[]

const parser: ParserType = ({ renderers }) => {
  const normalizedRenderers = normalizeRenderers({ renderers })
  return ({ data, text }) => {
    const contexts = parse({ renderers: normalizedRenderers, text })
    return render({ contexts, data, text })
  }
}

export default parser



///////////
// PARSE //
///////////

type ContextType = string | {
  matches: Array<string | void>,
  renderer: NormalizedRendererType,
}

type ParseType = ({
  renderers: NormalizedRendererType[],
  text: string,
}) => ContextType[]

const parse: ParseType = ({ renderers, text }) => {

  const regExpParts = renderers.map(renderer => `(${renderer.regExpPart})`)
  const regExp = new RegExp(regExpParts.join('|'), 'gm')

  const contexts = []
  let lastIndex = 0
  let regExpResult

  while (( regExpResult = regExp.exec(text) )) {

    const beforeChunk = text.substring(lastIndex, regExpResult.index)
    lastIndex = regExp.lastIndex

    if (beforeChunk) {
      contexts.push(beforeChunk)
    }

    renderers.some(renderer => {
      if (renderer.groupIndexes.some(gI => regExpResult[gI] != null)) {
        const matches = regExpResult
          .filter((_, index) => renderer.groupIndexes.includes(index))
          .slice(1)
        contexts.push({ matches, renderer })
        return true
      }
    })

  }

  const afterChunk = text.slice(lastIndex)
  if (afterChunk) {
    contexts.push(afterChunk)
  }

  return contexts
}


////////////
// RENDER //
////////////

type RenderType = ({
  contexts: ContextType[],
  data?: Object,
  text: string,
}) => mixed[]

const render: RenderType = ({ contexts, data, text }) => {

  const tree = []
  let currentIndex = 0
  let safety = 1000

  while (contexts.length) {

    if (!safety--) {
      console.error('Breaking early to avoid potential infinite loop')
      break
    }

    // If every item up to (and including) the current one is a string,
    // move the items from the contexts to the tree.
    const isPlainString = contexts.slice(0, currentIndex + 1).every(item => typeof item === 'string')
    if (isPlainString) {
      const removedItems = contexts.splice(0, currentIndex + 1)
      tree.push(...removedItems)
      currentIndex = 0
      continue
    }

    const currentContext = (contexts[currentIndex]: any)
    if (!currentContext || !currentContext.renderer || !currentContext.renderer.render) {
      console.error('No renderer found for the matching context in %o at %o', contexts, currentIndex)
      break
    }

    // If there is no context closer for the current context, strip it out.
    const hasContextCloser = contexts.some((context: any) => (
      context !== currentContext &&
      context &&
      context.renderer &&
      context.renderer.render === currentContext.renderer.render
    ))
    if (!hasContextCloser) {
      contexts.splice(currentIndex, 1)
      currentIndex = 0
      continue
    }

    const nextContextIndex = contexts.findIndex((context: any, index) => (
      index > currentIndex &&
      context &&
      context.renderer &&
      context.renderer.render
    ))
    const nextContext = (contexts[nextContextIndex]: any)
    if (!nextContext) {
      throw new Error(`Unable to render text: "${text}"`)
    }

    // If the next renderer is different, there is a nested renderer,
    // so move on to the next renderer's index.
    if (nextContext.renderer.render !== currentContext.renderer.render) {
      currentIndex = nextContextIndex
      continue
    }

    // Otherwise, there is no nested renderer,
    // so grab the children and matches to render the element.
    const element = nextContext.renderer.render({
      key: `${tree.length}:${currentIndex}:${nextContextIndex}`,
      children: contexts.slice(currentIndex + 1, nextContextIndex),
      data,
      startMatches: currentContext.matches,
      endMatches: nextContext.matches,
    })

    // If this is a nested renderer, splice the element's context down to the element.
    // Otherwise, remove the element's context and add the element to the tree.
    if (currentIndex !== 0) {
      contexts.splice(currentIndex, nextContextIndex - currentIndex + 1, element)
    }
    else {
      contexts.splice(0, nextContextIndex + 1)
      tree.push(element)
    }

    // Start again from the start of the context
    currentIndex = 0

  }

  return tree
}



///////////
// UTILS //
///////////

type NormalizedRendererType = {
  ...RendererType,
  groupIndexes: number[],
  regExpPart: string,
}

const normalizeRenderers = ({ renderers }): NormalizedRendererType[] => {
  return (renderers.reduce((accumulator, renderer, index) => {

    const previousMatchIndexes: NormalizedRendererType = (accumulator[accumulator.length - 1]: any)
    const previousLastGroupIndex = (
      previousMatchIndexes
        ? previousMatchIndexes.groupIndexes[previousMatchIndexes.groupIndexes.length - 1]
        : 0
    )

    const { match } = renderer
    if (typeof match === 'string') {
      const groupsCount = getGroupsCount({ regExp: new RegExp(match) }) + 1
      accumulator.push({
        ...renderer,
        regExpPart: match,
        groupIndexes: Array.from(new Array(groupsCount)).map((_, index) => index + previousLastGroupIndex + 1),
      })
    }
    else {
      const startGroupsCount = getGroupsCount({ regExp: new RegExp(match.start) }) + 1
      accumulator.push({
        ...renderer,
        regExpPart: match.start,
        groupIndexes: Array.from(new Array(startGroupsCount)).map((_, index) => index + previousLastGroupIndex + 1),
      })
      const endGroupsCount = getGroupsCount({ regExp: new RegExp(match.end) }) + 1
      accumulator.push({
        ...renderer,
        regExpPart: match.end,
        groupIndexes: Array.from(new Array(endGroupsCount)).map((_, index) => index + previousLastGroupIndex + 1 + startGroupsCount),
      })
    }

    return accumulator
  }, []): any)
}

const getGroupsCount = ({ regExp }) => {
  const newRegExp = new RegExp(regExp.toString() + '|')
  return newRegExp.exec('').length - 1
}
