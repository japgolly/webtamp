class State {
  constructor() {
    this.ops = [];
    this.errors = [];
    this.warns = [];
    this.manifest = {};
    this.deps = {};
    this.pending = {};
  }

  addOp(o) {
    this.ops.push(o)
  }
  addError(o) {
    this.errors.push(o)
  }
  addWarn(o) {
    this.warns.push(o)
  }
  addManifestEntry(k, v) {
    if (this.manifest[k] && this.manifest[k] != v) {
      const o = {}
      o[k] = this.manifest[k];
      this.addWarn("Overwritting manifest entry: " + JSON.stringify(o))
    }
    this.manifest[k] = v;
  }
  addState(r) {
    if (r.toObject) r = r.toObject;
    this.ops.push(r.ops);
    this.errors.push(r.errors);
    this.warns.push(r.warns);
    this.manifest = Object.assign(this.manifest, r.manifest);
  }

  // TODO this registration stuff is being conflated with manifest names

  registerNow(name) {
    if (this.pending[name])
      this.addError(`Duplicate asset: ${name}`);
    else if (!this.deps[name])
      this.deps[name] = [];
  }

  registerForLater(name, register) {
    if (this.deps[name])
      this.addError(`Duplicate asset: ${name}`);
    else {
      if (!this.pending[name])
        this.pending[name] = [];
      this.pending[name].push(register);
    }
  }

  addDependency(from, to) {
    const a = this.deps[from];
    if (!a)
      this.deps[from] = [to];
    else if (Object.isFrozen(a))
      this.addError(`Can't add dependency ${to} to terminal asset ${from}.`);
    else if (!a.includes(to))
      a.push(to);
  }

  /** Resolve required, pending deps */
  resolvePending() {
    const loop = () => {
      // This seems stupid, lazy way of doing it but it's been too long a day so meh
      const changed = [false];
      for (const [name, deps] of Object.entries(this.deps))
        for (const dep of deps) {
          if (this.deps[dep]) {
            // Already registered - do nothing
          } else if (this.pending[dep]) {
            const fns = this.pending[dep];
            this.pending[dep] = undefined;
            fns.forEach(fn => fn());
            changed[0] = true;
          } else {
            this.addError(`${name} referenced an unspecified asset: ${dep}`);
          }
        }
      return changed[0];
    }
    while (loop());
  }

  graphDependencies() {
    this.graph = undefined;
    if (this.ok()) {
      const graph = {};
      const add = n => {
        if (graph[n] === undefined) {

          graph[n] = null;
          const deps = this.deps[n] || [];
          deps.forEach(add);
          graph[n] = {};
          deps.forEach(d => graph[n][d] = graph[d]);
          Object.freeze(graph[n]);

        } else if (graph[n] === null) {
          this.addError(`Circular dependency on asset: ${n}`)
        }
      };
      Object.keys(this.deps).forEach(add);
      Object.freeze(graph);
      this.graph = graph;
    }
  }

  ok() {
    return this.errors.length == 0
  }

  results() {
    return {
      ops: this.ops,
      errors: this.errors,
      warns: this.warns,
      manifest: this.manifest,
      graph: this.graph,
    };
  }
}

module.exports = State;
