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
  mapObjectValues,
  memoise,
}
