import {
  Algo,
  ObjectTo,
  Op,
  OpReduction,
  OpReductionConst,
  RecArray,
  ValueOrRecArray
} from './types'
import * as Crypto from 'crypto'
import * as Util from 'util'
import { type } from 'os'

export function arrayMinus<A>(a: Array<A>, b: Array<A>): Array<A> {
  return a.filter(k => b.indexOf(k) === -1)
}

export function asArray<A>(v: ValueOrRecArray<A> | undefined): Array<A> {
  // @ts-ignore
  return v === undefined ? [] : flatten([v])
}

const assert = (cond: boolean, msg: string): void => {
  if (cond !== true)
    throw `Assertion failed: ${msg}`
}

// TODO delete assertObject
export const assertObject = (mandatoryKeys: Array<string>, optionalKeys: Array<string> = []) => (o: any) => {
  assert(typeof o === 'object' && !Array.isArray(o), `Object expected: ${o}`)
  const keys = arrayMinus(Object.keys(o), optionalKeys)
  const missing = arrayMinus(mandatoryKeys, keys)
  const extra = arrayMinus(keys, mandatoryKeys)
  assert(missing.length + extra.length === 0, `Missing: [${missing}]. Extra: [${extra}].`)
}

/** left-to-right function composition */
export const chain: <A>(_: Array<(_: A) => A>) => (_: A) => A =
  fs => input => {
    let a = input
    for (const f of fs)
      a = f(a)
    return a
  }

/** right-to-left function composition */
export const compose: <A>(_: Array<(_: A) => A>) => (_: A) => A =
  fs => chain(fs.reverse())

export const fixRelativePath: (_: string) => string =
  s => s.replace(/^(?:\.\/+)*\/*/g, '')

export function flatten<A>(array: RecArray<A>): Array<A> {
  // @ts-ignore
  return array.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])
}

export const hashData: (algo: Algo, outFmt: Crypto.HexBase64Latin1Encoding) => (data: Crypto.BinaryLike) => string =
  (algo, outFmt) => (data) => {
    const h = Crypto.createHash(algo)
    h.update(data)
    return h.digest(outFmt)
  }

export const inspect = (o: any): string => Util.inspect(o, true, null, true)

export function mapObjectValues<A, B>(src: ObjectTo<A>, f: (_: A) => B): ObjectTo<B> {
  const o: ObjectTo<B> = {}
  for (const [k, v] of Object.entries(src))
    o[k] = f(v)
  return o
}

export function memoise<A>(fn: () => A): () => A {
  const r: Array<A> = []
  return () => r[0] || (r[0] = fn()) || r[0]
}

export function opReduce<A>(f: OpReduction<A>): (op: Op) => A {
  return (op) => {
    switch (op.type) {
      case 'copy' : return f.copy(op)
      case 'write': return f.write(op)
    }
  }
}

export function opReduceConst<A>(f: OpReductionConst<A>): (op: Op) => A {
  return (op) => {
    switch (op.type) {
      case 'copy' : return f.copy
      case 'write': return f.write
    }
  }
}

export function tap<A>(f: (_: A) => any): (_: A) => A {
  return a => {
    f(a)
    return a
  }
}

export function removeUndefinedValues<A>(a: A): A {
  if (typeof a === 'object') {
    const o: object = {}
    for (const [k, v] of Object.entries(a))
      if (v !== undefined)
        // @ts-ignore
        o[k] = v
    // @ts-ignore
    return o as A
  } else
    return a
}