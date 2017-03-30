"use strict";

const
  Crypto = require('crypto'),
  FS = require('fs'),
  Path = require('path'),
  Util = require('util');

const assert = (cond, msg) => {
  if (cond !== true)
    throw `Assertion failed: ${msg}`;
};

const arrayMinus = (a, b) => a.filter(k => b.indexOf(k) === -1);

const assertObject = (mandatoryKeys, optionalKeys = []) => o => {
  assert(typeof o === 'object' && !Array.isArray(o), `Object expected: ${o}`)
  const keys = arrayMinus(Object.keys(o), optionalKeys);
  const missing = arrayMinus(mandatoryKeys, keys);
  const extra = arrayMinus(keys, mandatoryKeys);
  assert(missing.length + extra.length === 0, `Missing: [${missing}]. Extra: [${extra}].`)
};

const asArray = v => v === undefined ? [] : flatten([v]);

/** left-to-right function composition */
const chain = fs => input => {
  let a = input;
  for (const f of fs)
    a = f(a);
  return a;
}

/** right-to-left function composition */
const compose = fs => chain(fs.reverse());

const fixRelativePath = s => s ? s.replace(/^(?:\.\/+)*\/*/g, '') : s;

const flatten = array =>
  array.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);

const hashData = (algo, outFmt) => data => {
  const h = Crypto.createHash(algo);
  h.update(data);
  return h.digest(outFmt);
};

const inspect = o => Util.inspect(o, { maxDepth: null, colors: true });

const mapObjectValues = (src, f) => {
  const o = {}
  for (const [k, v] of Object.entries(src))
    o[k] = f(v);
  return o;
};

const memoise = fn => {
  const r = [];
  return () => r[0] || (r[0] = fn()) || r[0];
};

const tap = f => a => {
  f(a);
  return a;
}

class LocalSrc {
  constructor(ctx, path) {
    this.ctx = ctx;
    this.path = fixRelativePath(path);
    this.abs = Path.resolve(this.ctx, this.path);
    this.stats = memoise(() => FS.statSync(this.abs));
    this.size = () => this.stats().size;
    this.content = memoise(() => FS.readFileSync(this.abs));
  }
}

class OutputFile {
  constructor(ctx, path) {
    this.ctx = ctx;
    this.path = fixRelativePath(path);
    this.abs = Path.resolve(this.ctx, this.path);
  }
  withNewPath(path) {
    return new OutputFile(this.ctx, path);
  }
}

module.exports = {
  assertObject,
  asArray,
  chain,
  compose,
  fixRelativePath,
  flatten,
  hashData,
  inspect,
  mapObjectValues,
  memoise,
  tap,
  LocalSrc,
  OutputFile,
}
