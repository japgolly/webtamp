"use strict";

const
  FS = require('fs'),
  Glob = require("glob"),
  OutputName = require('./outputName'),
  Path = require('path'),
  State = require('./state'),
  Utils = require('./utils'),
  LocalSrc = Utils.LocalSrc;

const foldAsset = (state, cases) => {
  const go = inArray => (name, value) => {
    if (Array.isArray(value)) {
      const g = go(true);
      value.forEach(v => g(name, v));
    } else if (typeof value === 'string')
      cases.string(inArray)(name, value);
    else if (typeof value === 'object')
      switch (value.type) {
        case 'local':
          return cases.local(inArray)(name, value);
        case 'external':
          return cases.external(inArray)(name, value);
        case 'cdn':
          return cases.cdn(inArray)(name, value);
        default:
          state.addError(`${name} has invalid asset type: ${JSON.stringify(value.type)}`);
      }
    else
      state.addError(`${name} has an invalid value: ${JSON.stringify(value)}`);
  };
  return go(false);
}

/**
 * @param {State} state
 * @param {String} desc
 * @param {Any} manifestSetting Whatever the user has specified as their manifest setting
 * @param {() => ?String)} nameWhenTrue
 * @param {() => Any} fnArg
 * @param {String => ()} addFn
 */
const addManifest = (state, desc, manifestSetting, nameWhenTrue, fnArg, addFn) => {
  if (manifestSetting) {
    const maybeAdd = n => { if (n) addFn(n) };
    if (manifestSetting === true)
      maybeAdd(nameWhenTrue());
    else if (typeof manifestSetting === 'string')
      addFn(manifestSetting);
    else if (typeof manifestSetting === 'function')
      maybeAdd(manifestSetting(fnArg()));
    else
      state.addError(`${desc} has an invalid manifest: ${JSON.stringify(manifestSetting)}`);
  }
}

const arityAwareManifestName = (state, subname, inArray, name, manifest, fnArg, use) => {
  const desc = inArray ? `${name}:${subname}` : name;
  const whenTrue = () => {
    if (inArray)
      state.addError(`${desc} requires an explicit manifest name because it's in an array.`);
    else
      return name;
  }
  addManifest(state, desc, manifest, whenTrue, fnArg, use);
}

/**
 * @param  {String}                            src
 * @param  {String}                            target
 * @param  {State}                             state
 * @param  {NameTemplate => OutputNameFn}      mkOutputNameFn
 * @param  {OutputNameFn}                      outputNameFn0
 * @param  {Bool}                              inArray
 * @param  {String}                            name
 * @param  {String}                            files
 * @param  {NameTemplate?}                     outputName
 * @param  {String?}                           outputPath
 * @param  {Bool | Path => Maybe ManifestName} manifest
 */
const planLocal =
  ({ src, target, state, mkOutputNameFn }, outputNameFn0) => inArray => (name, value) => {
    const { files, outputName, outputPath, manifest } = value;
    state.checkThenRunIfNoErrors(() => {
      if (!files)
        state.addError(`${name} missing key: files`);
      if (manifest === true && inArray)
        state.addError(`${name} has {manifest: true} but requires an explicit name or function.`);
    }, () => {
      const src2 = value.src ? Path.resolve(src, value.src) : src;
      const fs = Glob.sync(files, { cwd: src2, nodir: true }).sort();
      if (fs.length == 0)
        state.addWarn(`${name} file(s) not found: ${files}`);
      else {
        const outputNameFn = outputName ? mkOutputNameFn(outputName) : outputNameFn0;
        state.registerNow(name);

        // Add each local file
        for (const f of fs) {
          const srcFilename = Path.resolve(src2, f);
          const contents = Utils.memoise(() => FS.readFileSync(srcFilename));
          let newName = outputNameFn({ name: f, contents });
          if (outputPath)
            newName = `${outputPath}/${newName}`;
          newName = newName.replace(/^\.\//g, '');

          // Copy file
          state.addOp({
            type: 'copy',
            from: new LocalSrc(src2, f),
            to: [target, newName],
          });

          const url = '/' + newName;
          state.addUrl(name, { url });

          // Add to manifest
          const whenTrue = () => {
            if (fs.length > 1)
              state.addWarn(`${name} has {manifest: true} but '${files}' matches more than 1 file.`);
            else
              return name;
          }
          addManifest(state, name, manifest, whenTrue, () => f, n => state.addManifestEntryLocal(n, url));
        }
      }
    })
  };

const planCdn =
  ({ src, state }, defaultAlgos = 'sha256') => inArray => (name, { url, integrity, manifest }) =>
  state.checkThenRunIfNoErrors(() => {
    if (!url)
      state.addError(`${name} missing key: url`);
    if (!integrity)
      state.addError(`${name} missing key: integrity`);
  }, () => {
    const desc = name;
    let i; // Option[ValidIntegrityAttribute]

    if (typeof integrity === 'string')
      i = integrity;

    // integrity: { files: 'image2.svg', algo: 'sha384' }
    else if (typeof integrity === 'object') {
      const algos = Utils.asArray(integrity.algo || defaultAlgos);
      const { files } = integrity;
      if (files) {
        const fs = Glob.sync(files, { cwd: src, nodir: true }).sort();
        if (fs.length == 0)
          state.addError(`${desc} integrity file(s) not found: ${files}`);
        else
          state.checkThenRunIfNoErrors(() => {
            const hashes = [];
            for (const algo of algos) {
              const hasher = Utils.hashData(algo, 'base64');
              for (const f of fs) {
                const h = hasher(FS.readFileSync(Path.resolve(src, f)));
                hashes.push(`${algo}-${h}`);
              }
            }
            return hashes;
          }, hashes => {
            i = hashes.join(' ')
          });
      } else
        state.addError(`${desc} integrity missing key: files`);

    } else
      state.addError(`${desc} has an invalid integrity value: ${JSON.stringify(integrity)}`);
    if (i) {
      const o = { url, integrity: i };
      const fnArg = () => o;
      state.registerNow(name);
      state.addUrl(name, Object.assign({ crossorigin: 'anonymous' }, o));
      arityAwareManifestName(state, url, inArray, name, manifest, fnArg, n => {
        state.addManifestEntryCdn(n, o);
      });
    }
  })

const planExternal =
  ({ state }) => inArray => (name, { path, manifest }) =>
  state.checkThenRunIfNoErrors(() => {
    if (!path)
      state.addError(`${name} missing key: path`);
  }, () => {
    const url = path.replace(/^\/?/, '/');
    state.registerNow(name);
    state.addUrl(name, { url });
    arityAwareManifestName(state, path, inArray, name, manifest, () => path, n => {
      state.addManifestEntryLocal(n, url);
    });
  })

const planRef = ({ state }) => (name, refName) => {
  state.addDependency(name, refName);
}

function run(config) {
  config.output = config.output || {};
  const
    state = new State(),
    src = Path.resolve(config.src || '.'),
    target = Path.resolve(config.output.dir || 'target'),
    outputNameFnDefaults = {},
    mkOutputNameFn = f => OutputName.make(f, outputNameFnDefaults),
    ctx = { state, src, target, mkOutputNameFn };
  if (!FS.existsSync(src))
    state.errors.push(`Src dir doesn't exist: ${src}`);
  if (!config.assets)
    state.errors.push('config.assets undefined.');

  const outputNameFn = mkOutputNameFn(config.output.name || '[basename]');

  if (state.ok()) {

    const cases = {
      string: _ => planRef(ctx),
      local: planLocal(ctx, outputNameFn),
      external: planExternal(ctx),
      cdn: planCdn(ctx),
    }

    // Parse config.optional
    {
      const o = config.optional;
      if (o) {
        const defer = f => inArray => (n, v) => {
          state.registerForLater(n, () => f(inArray)(n, v));
        }
        const casesDeferred = Utils.mapObjectValues(cases, defer);
        const add = foldAsset(state, casesDeferred);
        for (const [name, value] of Object.entries(o))
          add(name, value);
      }
    }

    // Parse config.assets
    {
      const add = foldAsset(state, cases);
      for (const [name, value] of Object.entries(config.assets))
        add(name, value);
    }

    // Graph dependencies
    state.resolvePending();
    state.graphDependencies();

    // Plugins
    for (const p of Utils.asArray(config.plugins)) {
      if (state.ok() && p)
        p(state);
    }
  }

  return state;
};

module.exports = {
  run
};
