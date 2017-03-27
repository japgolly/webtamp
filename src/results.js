class Results {
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
  addResults(r) {
    if (r.toObject) r = r.toObject;
    this.ops.push(r.ops);
    this.errors.push(r.errors);
    this.warns.push(r.warns);
    this.manifest = Object.assign(this.manifest, r.manifest);
  }

  registerTerminal(name) {
    if (this.pending[name] || this.deps[name])
      this.addError(`Duplicate asset: ${name}`);
    else {
      this.deps[name] = Object.freeze([]);
    }
  }

  registerForLater(name, register) {
    if (this.pending[name] || this.deps[name])
      this.addError(`Duplicate asset: ${name}`);
    else
      this.pending[name] = register;
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

  ok() {
    return this.errors.length == 0
  }

  toObject() {
    return {
      ops: this.ops,
      errors: this.errors,
      warns: this.warns,
      manifest: this.manifest,
    };
  }
}

module.exports = Results;
