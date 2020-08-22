import { LocalSrc, Plugin, Op, Falsy } from '../types'
import * as Utils from '../utils'
import State from '../state'

const assertResult = Utils.assertObject([], ['newFilename', 'newContent'])

export type LogicInput = {
  originallyFrom?: LocalSrc
  filename       : string
  content        : () => string
}

export type LogicResult = Falsy | {
  newFilename?: string
  newContent? : string
}

export type Logic = (s: State) => (_: LogicInput) => LogicResult

const main: (_: Logic) => Plugin = logic => state => {
  const modifyFn = logic(state)

  const attempt = (op: Op, input: LogicInput) => {
    const desc = input.originallyFrom ? input.originallyFrom.path : input.filename
    const result = state.scopeErrors(desc + ":", () => modifyFn(input))
    if (result) {
      assertResult(result)

      const contentChanged = result.newContent !== undefined && result.newContent !== input.content()
      const newContent = (contentChanged && result.newContent) || input.content()

      const oldFilename = op.to.path
      const newFilename = result.newFilename !== undefined ? Utils.fixRelativePath(result.newFilename) : oldFilename
      const newTo = op.to.withNewPath(newFilename)
      const filenameChanged = newFilename !== oldFilename

      state.removeOp(op)

      if (op.type === 'copy' && !contentChanged)
        state.ops.push(Object.assign({}, op, { to: newTo }))
      else
        state.addOpWrite(newTo, newContent, input.originallyFrom)

      if (filenameChanged)
        renameLocal(state, oldFilename, newFilename)
    }
  }

  const renameLocal = (state: State, before: string, after: string) => {
    const beforeUrl = '/' + before
    const afterUrl = '/' + after

    const replaceAtKey: <A> (key: String) => (_: A) => A = key => o => {
      // @ts-ignore
      if (o[key] === beforeUrl) {
        const r = Object.assign({}, o)
        // @ts-ignore
        r[key] = afterUrl
        return r
      } else
        return o
    }

    // Update state.urls
    state.urls = Utils.mapObjectValues(state.urls, urls => urls.map(replaceAtKey('url')))

    // Replace state.manifest
    state.manifest.mapValues(replaceAtKey('local'))
  }

  for (const op of state.ops) {
    if (op.type === 'copy') {
      if (!op.transitive) {
        const originallyFrom = op.from
        const filename = op.to.path
        const content = () => op.from.content().toString()
        attempt(op, { originallyFrom, filename, content })
      }
    } else if (op.type === 'write') {
      const originallyFrom = op.originallyFrom
      const filename = op.to.path
      const content = () => op.content
      attempt(op, { originallyFrom, filename, content })
    }
  }
}

export const stateless = (f: (_: LogicInput) => LogicResult) => main(_ => f)

type FilenameTest = RegExp | ((_: string) => boolean)

const widenFilenameTest: (t: FilenameTest) => (i: LogicInput) => boolean = t => {
  const test = (t instanceof RegExp) ? t.test.bind(t) : t
  return i => test(i.filename) || (i.originallyFrom && test(i.originallyFrom.path)) || false
}

const modifyContent = (testFilename: FilenameTest, modify: (_: string) => string, { failUnlessChange }: ({ failUnlessChange?: boolean }) = {}) => {
  const test = widenFilenameTest(testFilename)
  return main(s => {

    const done = (a: string) => ({ newContent: a })

    const apply: (i: LogicInput, before: string, after: string) => LogicResult =
      failUnlessChange
      ? (i, before, after) => {if (before === after) s.addError(`Failed to change ${i.filename}`); else return done(after)}
      : (i, before, after) => done(after)

    const run = (i: LogicInput) => {
      const content = i.content()
      return apply(i, content, modify(content))
    }

    return i => test(i) && run(i)
  })
}

export const rename = (testFilename: FilenameTest, modifyFilename: (_: string) => string) => {
  const test = widenFilenameTest(testFilename)
  return stateless(i => test(i) && { newFilename: modifyFilename(i.filename) })
}

export type ReplaceWebtampUrlOptions = {
  testFilename  : FilenameTest
  urlPattern?   : RegExp | Array<RegExp>
  urlQuotes?    : Array<string | [string, string?]>
  preprocessUrl?: (url: string) => (string | Falsy)
  allowCDN?     : boolean
}

export const replaceWebtampUrls: (_: ReplaceWebtampUrlOptions) => Plugin = opts => {
  const test = widenFilenameTest(opts.testFilename)

  const urlPatterns = Utils.asArray(opts.urlPattern ?? [])
  if (opts.urlQuotes)
    for (const q of opts.urlQuotes) {
      const [q1, q2] = typeof q === 'string' ? [q, q] : [q[0], q[1] || q[0]]
      const r1 = Utils.escapeRegExp(q1)
      const r2 = Utils.escapeRegExp(q2)
      const r = new RegExp(`(?<=${r1}).+?(?=${r2})`, "g")
      urlPatterns.push(r)
    }

  const preprocessUrl = opts.preprocessUrl ?? (u => u)

  const allowCDN = opts.allowCDN ?? true

  if (urlPatterns.length == 0)
    return s => s.addWarn(`No url patterns or quotes defined in: ${JSON.stringify(opts)}`)
  else
    return main(state => i => {

      const replaceUrl = (origUrl: string): string => {
        const url = preprocessUrl(origUrl)
        if (url) {
          const newUrl = state.resolveWebtampUrl(url, allowCDN)
          return newUrl ?? url
        } else
          return origUrl
      }

      const doIt = (i: LogicInput): LogicResult => {
        const orig = i.content()
        let result = orig
        for (const urlPattern of urlPatterns) {
          result = result.replace(urlPattern, replaceUrl)
        }
        return (result !== orig) && { newContent: result }
      }

      return test(i) && doIt(i)
    })
}

export const content = modifyContent
export const stateful = main
