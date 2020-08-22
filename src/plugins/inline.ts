import * as Mime from 'mime-types'
import * as FS from 'fs'
import * as Utils from '../utils'
import { Plugin, Op, FileContent } from '../types'

type CriteriaArg = {
  dest?       : string
  manifestName: string
  size        : () => number
  src?        : string
  stats?      : () => FS.Stats
}

// string = yes with custom mimeType
type CriteriaResult = undefined | boolean | string | null

type Criteria = (a: CriteriaArg) => CriteriaResult

export const data: (_: Criteria) => Plugin = criteria => state => {

  for (const [name, value] of Object.entries(state.manifest.getEntries())) {
    const dest = value.local ? Utils.fixRelativePath(value.local) : undefined

    const inline = (op: Op, arg: CriteriaArg, contentBufferFn: FileContent) => {
      const result = criteria(arg)
      if (result || result === '')
        state.checkThenRunIfNoErrors(() => {
          if (result === true) {
            const m = (arg.dest && Mime.lookup(arg.dest)) || (arg.src && Mime.lookup(arg.src))
            if (m)
              return m
            else
              state.addError(`Error inlining ${name}. Unable to discern mime-type for ${arg.dest}`)
          } else if (typeof result === 'string')
            return result
          else
            state.addError(`Error inlining ${name}. Invalid mime-type: ${JSON.stringify(result)}`)
        }, mimeType => {
          state.removeOp(op)
          const mediatype = mimeType === '' ? '' : `${mimeType};`
          const data = contentBufferFn().toString("base64")
          state.manifest.delete(name)
          state.manifest.addUrl(name, `data:${mediatype}base64,${data}`)
        })
    }

    let i = state.ops.length
    while (i-- > 0) {
      // TODO Below we use 'from' & 'originallyFrom' but wouldn't 'to' make more sense?
      const op = state.ops[i]
      if (op.type === 'write' && op.to.path === dest) {
        const arg = {
          manifestName: name,
          src: op.originallyFrom?.abs,
          stats: op.originallyFrom?.stats, // TODO yuk
          size: () => op.content.length,
          dest,
        }
        inline(op, arg, () => Buffer.from(op.content))
        i = 0
      } else if (op.type === 'copy' && op.to.path === dest) {
        const arg = {
          manifestName: name,
          src: op.from.abs,
          stats: op.from.stats,
          size: op.from.size,
          dest,
        }
        inline(op, arg, op.from.content)
        i = 0
      }
    }
  }
}
