const memoise = fn => {
  const r = [];
  return () => r[0] || (r[0] = fn()) || r[0];
};

module.exports = {
  memoise,
}
