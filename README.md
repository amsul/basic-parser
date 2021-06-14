# basic-parser
An extremely basic token-based parser


## Examples

```js
import createRenderer from 'basic-parser'

const renderers = [
  {
    match: '_',
    renderMatch: ({ key, children, ...asdf }) => <em key={key}>{children}</em>,
  },
  {
    match: '\\*',
    renderMatch: ({ key, children }) => <strong key={key}>{children}</strong>,
  },
]
const render = createRenderer(renderers)

const text = 'Any string with tokens recognized by the renderers'
const tree = render(text, data)
```
