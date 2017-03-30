"use strict";

const
  Mime = require('mime-types'),
  Path = require('path'),
  Utils = require('../utils');

// criteria :: {manifestName, src, dest, stat(), size()} =>
//             undefined | Bool | (mime-type :: null | string)

const inlineData = criteria => state => {
  for (const [name, value] of Object.entries(state.manifest)) {
    const dest = Utils.fixRelativePath(value.local);
    const op = dest && state.ops.find(copiesTo(dest));
    if (dest && op) {

      const arg = {
        manifestName: name,
        src: op.from.abs,
        stat: op.from.stat,
        size: op.from.size,
        dest,
      }

      const result = criteria(arg);
      if (result || result === '')
        state.checkThenRunIfNoErrors(() => {
          if (result === true) {
            const m = Mime.lookup(arg.dest) || Mime.lookup(arg.src);
            if (m)
              return m;
            else
              state.addError(`Error inlining ${name}. Unable to discern mime-type for ${arg.dest}`);
          } else if (typeof result === 'string')
            return result;
          else
            state.addError(`Error inlining ${name}. Invalid mime-type: ${JSON.stringify(result)}`);
        }, mimeType => {
          state.removeOp(op);
          const mediatype = mimeType === '' ? '' : `${mimeType};`;
          const data = op.from.content().toString("base64");
          state.manifest[name] = { url: `data:${mediatype}base64,${data}` };
        });

    }
  }
};

const copiesTo = path => op =>
  op.type === 'copy' && op.to.path === path;

module.exports = {
  data: inlineData,
};
