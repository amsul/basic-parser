import React from 'react'
import basicParser from './dist/basic-parser'

const renderers = [
  {
    match: { start: '\\{', end: '\\}' },
    render({ children, data }) {
      return data[children] || ''
    },
  },
  {
    match: '_',
    render({ key, children }) {
      return <i key={key}>{children}</i>
    },
  },
  {
    match: '\\*',
    render({ key, children }) {
      return <b key={key}>{children}</b>
    },
  },
  {
    match: { start: '\\[', end: '\\](?:\\(([^\\)]+?)\\))?' },
    render({ children, endMatches, key }) {
      return <a key={key} href={endMatches[0]}>{children}</a>
    },
  },
  {
    match: '~',
    render({ key, children }) {
      return <s key={key}>{children}</s>
    },
  },
]

const render = basicParser({ renderers })

export default class ExampleApp extends React.Component {
  render() {
    return (
      <div>
        <p>{render({ text: 'Hi {firstName}!', data: { firstName: 'Sergey' } })}</p>
        <p>{render({ text: 'Hi there!' })}</p>
        <p>{render({ text: 'Hi *dude*' })}</p>
        <p>{render({ text: 'Hi _dude_' })}</p>
        <p>{render({ text: 'Hi *_dude_*' })}</p>
        <p>{render({ text: 'Hi _*dude*_' })}</p>
        <p>{render({ text: 'hi! [Hello *there* ~huh~ ??!?!?!](google.com) *dude* :) _*React*_' })}</p>
      </div>
    )
  }
}
