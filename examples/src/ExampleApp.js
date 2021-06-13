import React from 'react'
import basicParser from './dist/basic-parser'

const renderers = [
  {
    match: { start: '\\{', end: '\\}' },
    renderMatch({ children, data }) {
      return data[children] || ''
    },
  },
  {
    match: '_',
    renderMatch({ key, children }) {
      return <i key={key}>{children}</i>
    },
  },
  {
    match: '\\*',
    renderMatch({ key, children }) {
      return <b key={key}>{children}</b>
    },
  },
  {
    match: { start: '\\[', end: '\\](?:\\(([^\\)]+?)\\))?' },
    renderMatch({ children, endMatches, key }) {
      return (
        <a key={key} href={endMatches[0]}>
          {children}
        </a>
      )
    },
  },
  {
    match: '~',
    renderMatch({ key, children }) {
      return <s key={key}>{children}</s>
    },
  },
]

const render = basicParser(renderers)

export default class ExampleApp extends React.Component {
  render() {
    return (
      <div>
        <p>{render('Hi {firstName}!', { firstName: 'Sergey' })}</p>
        <p>{render('Hi there!')}</p>
        <p>{render('Hi *dude*')}</p>
        <p>{render('Hi _dude_')}</p>
        <p>{render('Hi *_dude_*')}</p>
        <p>{render('Hi _*dude*_')}</p>
        <p>
          {render(
            'hi! [Hello *there* ~huh~ ??!?!?!](google.com) *dude* :) _*React*_',
          )}
        </p>
        <p>{render('this is *bold* and this \\*is not\\*')}</p>
        <p>{render('this is _styled_ and this \\_is not\\_')}</p>
        <p>{render('this has the escape character \\\\* as well')}</p>
      </div>
    )
  }
}
