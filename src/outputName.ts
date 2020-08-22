import { Algo, InlineFile } from './types'
import * as Path from 'path'
import * as Utils from './utils'

export type MakeOptions = {
  defaultHashAlgo ?: Algo
  defaultHashWidth?: number
}

export type MakeResult = (f: InlineFile) => string

export function make(pat0: string, options: MakeOptions = {}): MakeResult {

  const { defaultHashAlgo = 'sha256', defaultHashWidth = 32 } = options

  const pat = pat0
    .replace(/\[hash(?::(\d+))?\]/g, (_, w) => `[${defaultHashAlgo}:${w || defaultHashWidth}]`)

  const wtf = { fn: (i: InlineFile, n: string): string => n }

  const add = (f: (i: InlineFile, n: string) => string): void => {
    const next = wtf.fn
    wtf.fn = (i, n) => next(i, f(i, n))
  }

  const addToken = (token: string, fn: (i: InlineFile) => string): void => {
    const regex = new RegExp(`\\[${token}\\]`, "g")
    if (regex.test(pat))
      add((i, n) => n.replace(regex, fn(i)))
  }

  const addHash = (algo: Algo, token?: string): void => {
    const hasher = Utils.hashData(algo, 'hex')
    const regex = new RegExp(`\\[${token ?? algo}(?::(\\d+))?\\]`, "g")
    if (regex.test(pat))
      add((i, n) => {
        const hash = Utils.memoise(() => hasher(i.contents()))
        const replace = (_: any, width: number): string => width ? hash().substr(0, width) : hash()
        return n.replace(regex, replace)
      })
  }

  const nameOnly = (f: (f: string) => string) => (i: InlineFile) => f(i.name)

  addToken('basename', nameOnly(Path.basename))
  addToken('name', nameOnly(f => Path.basename(f, Path.extname(f))))
  addToken('ext', nameOnly(f => Path.extname(f).replace(/^\./, '')))
  addToken('path', nameOnly(Path.dirname))
  addHash('md5')
  addHash('sha1')
  addHash('sha256')
  addHash('sha384')
  addHash('sha512')

  const fn = wtf.fn
  return i => fn(i, pat)
}
