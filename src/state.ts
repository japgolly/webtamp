import { assertObject, fixRelativePath, opReduce } from './utils'
import { Manifest } from './manifest'
import {
  FileContent,
  LocalSrc,
  ObjectTo,
  Op,
  OpReduction,
  OutputFile,
  RecObjectTo,
  URL,
} from './types'

export default class State {
  public readonly src: string
  public readonly target: string
  public  ops     : Array<Op>
  private errors  : Array<string>
  private warns   : Array<string>
  public  manifest: Manifest
  public  urls    : ObjectTo<Array<URL>>
  private deps    : ObjectTo<Array<string>>
  private pending : ObjectTo<Array<() => any> | undefined>
  private graph   : undefined | RecObjectTo<string | null>

  constructor(src: string, target: string) {
    this.src      = src
    this.target   = target
    this.ops      = []
    this.errors   = []
    this.warns    = []
    this.manifest = new Manifest(this)
    this.urls     = {}
    this.deps     = {}
    this.pending  = {}
  }

  toObject(): ObjectTo<any> {
    return {
      src     : this.src,
      target  : this.target,
      ops     : this.ops,
      errors  : this.errors,
      warns   : this.warns,
      manifest: this.manifest,
      urls    : this.urls,
      deps    : this.deps,
      pending : this.pending,
      }
  }

  private addOp(o: Op): void {
    this.ops.push(o)
  }

  addOpCopy(from: LocalSrc, to: string | OutputFile, transitive?: boolean): void {
    this.addOp({
      type: 'copy',
      from,
      to: (to instanceof OutputFile) ? to : new OutputFile(this.target, to),
      transitive: !!transitive,
    })
  }

  addOpWrite(to: string | OutputFile, content: string, originallyFrom?: LocalSrc): void {
    this.addOp({
      type: 'write',
      originallyFrom,
      to: (to instanceof OutputFile) ? to : new OutputFile(this.target, to),
      content,
    })
  }

  addError(o: string): void {
    this.errors.push(o)
  }

  addWarn(o: string): void {
    this.warns.push(o)
  }

  addUrl(assetName: string, url: URL): void {
    assertObject(['url'], ['integrity', 'crossorigin', 'transitive', 'as'])(url)
    if (!this.urls[assetName])
      this.addError(`Asset not registered: ${assetName}`)
    this.urls[assetName].push(url)
  }

  scopeErrors<A>(mod: string | ((_: string) => string), block: () => A): A {
    if (mod === '' || !mod) return block()
    const e = this.errors.length
    const r = block()
    let i = this.errors.length
    const f: (_: string) => string =
      (typeof mod === 'string') ?
      e => `${mod} ${e}` :
      mod
    while (--i >= e)
      this.errors[i] = f(this.errors[i])
    return r
  }

  removeOp(op: Op): void {
    this.ops = this.ops.filter(o => o !== op)
  }

  getOpThatCreatesLocalFile(path: string): Op | undefined {
    const p = fixRelativePath(path)
    const f: OpReduction<boolean> = {
      copy : (op: Op) => op.to.path === p,
      write: (op: Op) => op.to.path === p,
    }
    const r = this.ops.filter(opReduce(f))
    if (r.length === 0)
      this.addError(`Unable to find op that writes to ${path}`)
    else if (r.length > 1)
      this.addError(`Multiple ops write to ${path}: ${r}`)
    return r[0]
  }

  checkThenRunIfNoErrors<A>(check: () => (A | false), run: (_: A) => any): void {
    const errCount = this.errors.length
    const a = check()
    if (this.errors.length === errCount && a !== false)
      run(a)
  }

  registerNow(name: string): void {
    if (this.pending[name])
      this.addError(`Duplicate asset: ${name}`)
    else if (!this.deps[name]) {
      this.deps[name] = []
      this.urls[name] = []
    }
  }

  registerForLater(name: string, register: () => any) {
    if (this.deps[name])
      this.addError(`Duplicate asset: ${name}`)
    else {
      if (!this.pending[name])
        this.pending[name] = []
      // @ts-ignore: undefined
      this.pending[name].push(register)
    }
  }

  addDependency(from: string, to: string) {
    const a = this.deps[from]
    if (!a)
      this.deps[from] = [to]
    else if (Object.isFrozen(a))
      this.addError(`Can't add dependency ${to} to terminal asset ${from}.`)
    else if (!a.includes(to))
      a.push(to)
  }

  /** Resolve required, pending deps */
  resolvePending() {
    const loop = () => {
      // This seems stupid, lazy way of doing it but it's been too long a day so meh
      const changed = [false]
      for (const [name, deps] of Object.entries(this.deps))
        for (const dep of deps) {
          if (this.deps[dep]) {
            // Already registered - do nothing
          } else if (this.pending[dep]) {
            const fns = this.pending[dep]
            this.pending[dep] = undefined
            if (fns)
              fns.forEach(fn => fn())
            changed[0] = true
          } else {
            this.addError(`${name} referenced an unspecified asset: ${dep}`)
          }
        }
      return changed[0]
    }
    while (loop());
  }

  graphDependencies() {
    this.graph = undefined
    if (this.ok()) {
      const graph: RecObjectTo<string | null> = {}
      const add = (n: string) => {

        if (graph[n] === undefined) {

          graph[n] = null
          const deps = this.deps[n] || []
          deps.forEach(add)
          const graphN: RecObjectTo<string | null> = {}
          graph[n] = graphN
          deps.forEach(d => graphN[d] = graph[d])
          Object.freeze(graph[n])

        } else if (graph[n] === null) {
          this.addError(`Circular dependency on asset: ${n}`)
        }
      }
      Object.keys(this.deps).forEach(add)
      Object.freeze(graph)
      this.graph = graph
    }
    // console.log("State: ", this)
    // console.log("Manifest: ", this.manifest.getEntries())
  }

  ok() {
    return this.errors.length == 0
  }

  results() {
    return {
      ops: this.ops,
      errors: this.errors.sort(),
      warns: this.warns.sort(),
      manifest: this.manifest,
      graph: this.graph,
    }
  }

  static opContent: (op: Op) => string =
    opReduce({
      copy : (op) => op.from.content().toString(),
      write: (op) => op.content,
    })
}
