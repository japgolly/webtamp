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

    function inline(op, arg, contentBufferFn) {
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
          const data = contentBufferFn().toString("base64");
          state.manifest[name] = { url: `data:${mediatype}base64,${data}` };
        });
    }

    let i = state.ops.length;
    while (i-- > 0) {
      // TODO Below we use 'from' & 'originallyFrom' but wouldn't 'to' make more sense?
      const op = state.ops[i];
      if (op.type === 'write' && op.to.path === dest) {
        const arg = {
          manifestName: name,
          src: op.originallyFrom.abs,
          stat: op.originallyFrom.stat, // TODO yuk
          size: op.content.size,
          dest,
        }
        inline(op, arg, () => new Buffer(op.content));
        i = 0;
      } else if (op.type === 'copy' && op.to.path === dest) {
        const arg = {
          manifestName: name,
          src: op.from.abs,
          stat: op.from.stat,
          size: op.from.size,
          dest,
        }
        inline(op, arg, op.from.content);
        i = 0;
      }
    }
  }
};

module.exports = {
  data: inlineData,
};
