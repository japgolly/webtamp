import { memoise, fixRelativePath } from './utils'
import * as FS from 'fs'
import * as Path from 'path'
import State from './state'

export type Algo =
  'blake2b512' |
  'blake2s256' |
  'md4' |
  'md5' |
  'md5-sha1' |
  'mdc2' |
  'ripemd160' |
  'sha1' |
  'sha224' |
  'sha256' |
  'sha3-224' |
  'sha3-256' |
  'sha3-384' |
  'sha3-512' |
  'sha384' |
  'sha512' |
  'sha512-224' |
  'sha512-256' |
  'shake128' |
  'shake256' |
  'sm3' |
  'whirlpool'

export type ObjectTo<V> = {[key: string]: V}

export interface RecObjectTo<A> {
  [key: string]: A | RecObjectTo<A>
}

export type RecArray<A> = Array<A> | Array<RecArray<A>>

export type ValueOrRecArray<A> = A | RecArray<A>

export type ValueOrArray<A> = A | Array<A>

export class LocalSrc {
  public ctx    : string
  public path   : string
  public abs    : string
  public stats  : () => FS.Stats
  public size   : () => number
  public content: () => Buffer

  constructor(ctx: string, path: string) {
    this.ctx     = ctx
    this.path    = fixRelativePath(path)
    this.abs     = Path.resolve(this.ctx, this.path)
    this.stats   = memoise(() => FS.statSync(this.abs))
    this.size    = () => this.stats().size
    this.content = memoise(() => FS.readFileSync(this.abs))
  }
}

export class OutputFile {
  public ctx : string
  public path: string
  public abs : string

  constructor(ctx: string, path: string) {
    this.ctx = ctx
    this.path = fixRelativePath(path)
    this.abs = Path.resolve(this.ctx, this.path)
  }

  withNewPath(path: string): OutputFile {
    return new OutputFile(this.ctx, path)
  }
}

export type As = 'script' | 'style'

export type CDN = {
  url        : string
  integrity? : string
  transitive?: boolean
  as?        : As
}

export type URL = {
  url         : string
  integrity?  : string
  crossorigin?: 'anonymous'
  transitive? : boolean
  as?         : As
}

export type Op = OpCopy | OpWrite

export type OpCopy = {
  type      : 'copy'
  from      : LocalSrc
  to        : OutputFile
  transitive: boolean
}

export type OpWrite = {
  type           : 'write'
  originallyFrom?: LocalSrc
  to             : OutputFile
  content        : string
}

export type OpReduction<A> = {
  copy : (op: OpCopy ) => A
  write: (op: OpWrite) => A
}

export type OpReductionConst<A> = {
  copy : A
  write: A
}

export type FileContent = () => (string | Buffer)

export type InlineFile = {name: string, contents: FileContent}

export type Falsy = null | undefined | false

export type Plugin = (s: State) => void
