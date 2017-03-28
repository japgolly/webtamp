const Crypto = require('crypto');

const asArray = v => flatten([v]);

const flatten = array =>
  array.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);

const hashData = (algo, outFmt) => data => {
  const h = Crypto.createHash(algo);
  h.update(data);
  return h.digest(outFmt);
};

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
  asArray,
  flatten,
  hashData,
  mapObjectValues,
  memoise,
}
