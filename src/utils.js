const
  Crypto = require('crypto'),
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

module.exports = {
  assertObject,
  asArray,
  fixRelativePath,
  flatten,
  hashData,
  inspect,
  mapObjectValues,
  memoise,
}
