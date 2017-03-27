const
  Crypto = require('crypto'),
  FS = require('fs'),
  Path = require('path'),
  Utils = require('./utils');

/** @result {name, contents :: () => string} => string */
function mkOutputNameFn(pat0, {
  defaultHashAlgo = 'sha256',
  defaultHashWidth = 32
} = {}) {

  const pat = pat0
    .replace(/\[hash(?::(\d+))?\]/g, (_, w) => `[${defaultHashAlgo}:${w || defaultHashWidth}]`);

  const wtf = { fn: (i, n) => n };
  const add = f => {
    const next = wtf.fn;
    wtf.fn = (i, n) => next(i, f(i, n));
  };
  const addToken = (token, fn) => {
    const regex = new RegExp(`\\[${token}\\]`, "g");
    if (regex.test(pat))
      add((i, n) => n.replace(regex, fn(i)))
  }

  const addHash = (token, algo) => {
    const regex = new RegExp(`\\[${token}(?::(\\d+))?\\]`, "g")
    if (regex.test(pat))
      add((i, n) => {
        const hash = Utils.memoise(() => {
          const h = Crypto.createHash(algo || token);
          h.update(i.contents());
          return h.digest('hex');
        })
        const replace = (_, width) => width ? hash().substr(0, width) : hash();
        return n.replace(regex, replace);
      })

  };

  const nameOnly = f => i => f(i.name)

  addToken('basename', nameOnly(Path.basename));
  addToken('name', nameOnly(f => Path.basename(f, Path.extname(f))));
  addToken('ext', nameOnly(f => Path.extname(f).replace(/^\./, '')));
  addToken('path', nameOnly(Path.dirname));
  addHash('md5');
  addHash('sha1');
  addHash('sha256');
  addHash('sha384');
  addHash('sha512');

  const fn = wtf.fn;
  return i => fn(i, pat);
}

module.exports = mkOutputNameFn;
