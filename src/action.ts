import { Op, OpCopy, OpWrite, OpReduction } from './types'
import { opReduce } from './utils'
import { sprintf } from 'sprintf-js'
import * as fs from 'fs-extra'
import * as Path from 'path'

const fmtInt = (n: number): string => n.toLocaleString()

const fmtPath = (p: string): string => {
  const r = Path.relative(process.cwd(), p)
  return r.startsWith("../../../") ? p : r
}

/**
 * Compares ops for sorting (for aesthetic purposes).
 */
const opCmp = (a: Op, b: Op): number =>
  a.type !== b.type ? a.type.localeCompare(b.type) :
  a.type === 'copy' ? a.from.abs.localeCompare((b as OpCopy).from.abs) :
  a.type === 'write' ? a.to.path.localeCompare((b as OpWrite).to.path) :
  0

type Stats = { files: number, bytes: number }
type Runner = (ord: Number) => (op: Op) => void

export type Options = { dryRun?: boolean }

export function run(plan: { ops: Array<Op>, errors: Array<string>, warns: Array<string> }, options: Options = {}): void {
  const { ops, errors, warns } = plan
  const { dryRun } = options

  warns.forEach(msg => console.warn(`[WARN] ${msg}`))

  if (errors.length === 0) {
    const stats: Stats = { files: 0, bytes: 0 }
    const runner = runnerAppend([
      recordStats(stats),
      runnerLog(ops), //
      !dryRun && runnerPerform(errors), //
    ])

    if (dryRun)
      console.info("DRY-RUN MODE. No actions will be performed.\n")

    ops
      .sort(opCmp)
      .forEach((op, i) => runner(i + 1)(op))

    if (ops.length > 0)
      console.info()
    console.info(`Wrote ${fmtInt(stats.files)} files comprising ${fmtInt(stats.bytes)} bytes.`)
  }

  errors.forEach(msg => console.error(`[ERROR] ${msg}`))
  console.error(`${fmtInt(warns.length)} warnings, ${fmtInt(errors.length)} errors.`)
}

const recordStats = (stats: Stats): Runner => _ => {
  const add = (n: number) => (k: 'files' | 'bytes') => stats[k] = stats[k] + n
  const inc = add(1)
  return opReduce({
    copy: op => {
      inc('files')
      add(op.from.size())('bytes')
    },
    write: op => {
      inc('files')
      add(op.content.length)('bytes')
    },
  })
}

const runnerLog = (ops: Array<Op>): Runner => {
  const determineColumnLength = () => {
    const get: OpReduction<number> = {
      copy: op => fmtPath(op.to.path).length,
      write: op => fmtPath(op.to.path).length,
    }
    const lens: Array<number> = ops.map(opReduce(get))
    return lens.concat([1]).reduce((a, b) => Math.max(a, b))
  }
  const colLen = determineColumnLength()
  const idxLen = (ops.length + '').length
  const fmtIdx = `[%${idxLen}d/${ops.length}]`
  const fmtCopy = `${fmtIdx} Copy  %-${colLen}s ← %s`
  const fmtWrite = `${fmtIdx} Write %-${colLen}s ← %s bytes`
  return n => opReduce({
    copy: op => console.log(sprintf(fmtCopy, n, fmtPath(op.to.path), fmtPath(op.from.abs))),
    write: op => console.log(sprintf(fmtWrite, n, fmtPath(op.to.path), fmtInt(op.content.length))),
  })
}

const runnerPerform = (errors: Array<string>): Runner => _ => opReduce({
  copy: op => {
    const from = op.from.abs
    const to = op.to.abs
    try {
      fs.copySync(from, to)
    } catch (err) {
      errors.push(`Error copying ${fmtPath(from)}: ${err}`)
    }
  },
  write: op => {
    const to = op.to.abs
    try {
      fs.outputFileSync(to, op.content)
    } catch (err) {
      errors.push(`Error creating ${fmtPath(to)}: ${err}`)
    }
  },
})

const runnerAppend = (runners: Array<Runner | false>): Runner => {
  const rs: Array<Runner> = []
  runners.forEach(r => {if (r) rs.push(r)})
  return ord => {
    const run = (op: Op) => {rs.forEach(r => r(ord)(op))}
    return opReduce({
      copy : run,
      write: run,
    })
  }
}
