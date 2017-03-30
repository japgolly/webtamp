"use strict";

const
  FS = require('fs'),
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
        src: Path.join(op.from[0], op.from[1]),
        dest,
        stat: Utils.memoise(() => FS.statSync(arg.src)),
        size: () => arg.stat().size,
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
          const data = FS.readFileSync(arg.src).toString("base64");
          state.manifest[name] = { url: `data:${mediatype}base64,${data}` };
        });

    }
  }
};

const copiesTo = path => op =>
  op.type === 'copy' && Utils.fixRelativePath(op.to[1]) === path;

module.exports = {
  data: inlineData,
};
