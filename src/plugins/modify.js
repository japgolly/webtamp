"use strict";

const
  FS = require('fs'),
  Path = require('path'),
  Utils = require('../utils');

// logic ::
// State =>
// { filename :: String, content :: () => String} =>
// ?{ ?newFilename :: String, ?newContent :: String }

const assertResult = Utils.assertObject([], ['newFilename', 'newContent']);

const main = logic => state => {
  const modifyFn = logic(state);

  const attempt = (op, input) => {
    const result = modifyFn(input);
    if (result) {
      assertResult(result);

      const contentChanged = result.newContent !== undefined && result.newContent !== input.content();
      const newContent = contentChanged ? result.newContent : input.content();

      const oldFilename = op.to[1];
      const newFilename = result.newFilename !== undefined ? Utils.fixRelativePath(result.newFilename) : oldFilename;
      const newTo = [op.to[0], newFilename];
      const filenameChanged = newFilename !== oldFilename;

      const newOp =
        (op.type === 'copy' && !contentChanged) ?
        Object.assign({}, op, { to: newTo }) : //
        {
          type: 'write',
          to: newTo,
          content: newContent,
        };

      state.removeOp(op);
      state.ops.push(newOp);

      if (filenameChanged)
        renameLocal(state, oldFilename, newFilename);
    }
  };

  const renameLocal = (state, before, after) => {
    const beforeUrl = '/' + before;
    const afterUrl = '/' + after;

    const replaceAtKey = key => o => {
      if (o[key] === beforeUrl) {
        const r = Object.assign({}, o);
        r[key] = afterUrl;
        return r;
      } else
        return o;
    }

    // Update state.urls
    state.urls = Utils.mapObjectValues(state.urls, urls => urls.map(replaceAtKey('url')));

    // Repalce state.manifest
    state.manifest = Utils.mapObjectValues(state.manifest, replaceAtKey('local'));
  };

  for (const op of state.ops) {
    if (op.type === 'copy') {
      const filename = op.to[1];
      const content = Utils.memoise(() => FS.readFileSync(Path.join(op.from[0], op.from[1])).toString());
      attempt(op, { filename, content })
    } else if (op.type === 'write') {
      const filename = op.to[1];
      const content = () => op.content;
      attempt(op, { filename, content })
    }
  }
};

const stateless = f => main(_ => f);

const widenFilenameTest = t => {
  const test = (t instanceof RegExp) ? f => t.test(f) : t;
  return i => test(i.filename);
}

const searchReplace = (testFilename, modifyContent) => {
  const test = widenFilenameTest(testFilename);
  return stateless(i => test(i) && { newContent: modifyContent(i.content()) });
}

const rename = (testFilename, modifyFilename) => {
  const test = widenFilenameTest(testFilename);
  return stateless(i => test(i) && { newFilename: modifyFilename(i.filename) });
}

module.exports = {
  rename,
  stateful: main,
  stateless,
  searchReplace,
};
