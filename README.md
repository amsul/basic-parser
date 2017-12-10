# basic-parser
An extremely basic token-based parser


## Examples

```js
import basicParser from 'basic-parser'

const renderers = [/* ... */]
const render = basicParser({ renderers })

const text = 'Any string with tokens recognized by the renderers'
const tree = render({ text })
```
