class Results {
  constructor() {
    this.ops = [];
    this.errors = [];
    this.warns = [];
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
  addResults(r) {
    if (r.toObject) r = r.toObject;
    this.ops.push(r.ops)
    this.errors.push(r.errors)
    this.warns.push(r.warns)
  }

  ok() {
    return this.errors.length == 0
  }

  toObject() {
    return {
      ops: this.ops,
      errors: this.errors,
      warns: this.warns
    };
  }
}

module.exports = Results;
