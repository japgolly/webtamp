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
  ({ state, mkOutputNameFn }, outputNameFn0) => inArray => (name, value) => {
    const { files, outputName, outputPath, manifest, validate } = value;
    state.checkThenRunIfNoErrors(() => {
      if (!files)
        state.addError(`${name} missing key: files`);
      if (manifest === true && inArray)
        state.addError(`${name} has {manifest: true} but requires an explicit name or function.`);
    }, () => {
      const src = value.src ? Path.resolve(state.src, value.src) : state.src;
      const fs = Glob.sync(files, { cwd: src, nodir: true }).sort();

      // Validate
      let validateFn =
        typeof validate === 'function' ? validate :
        typeof validate === 'string' ? _ => validate :
        typeof validate === 'boolean' ? _ => [] :
        typeof validate === 'undefined' ? defaultLocalFileValidation :
        null; // lol do more lazy!

      const validationErrors = Utils.asArray(validateFn(fs, files, src)).filter(e => e && e !== true);
      if (validationErrors.length > 0) {
        const descSrc = value.src ? value.src + '/' : '';
        const desc = `${name}:${descSrc}${files}`;
        validationErrors.forEach(e => state.addError(`${desc} - ${e}`));

      } else {
        const outputNameFn = outputName ? mkOutputNameFn(outputName) : outputNameFn0;
        state.registerNow(name);

        // Add each local file
        for (const f of fs) {
          const srcFilename = Path.resolve(src, f);
          const contents = Utils.memoise(() => FS.readFileSync(srcFilename));
          let newName = outputNameFn({ name: f, contents });
          if (outputPath)
            newName = `${outputPath}/${newName}`;
          newName = newName.replace(/^\.\//g, '');

          // Copy file
          state.addOpCopy(new LocalSrc(src, f), newName);

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

const defaultLocalFileValidation = (fs, glob, src) =>
  fs.length === 0 && `0 files found.`;
// fs.length === 0 && `0 files found. (Add {validate: false} to disable this check.)`;

const planCdn =
  ({ state }, defaultAlgos = 'sha256') => inArray => (name, { url, integrity, manifest }) =>
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
        const fs = Glob.sync(files, { cwd: state.src, nodir: true }).sort();
        if (fs.length == 0)
          state.addError(`${desc} integrity file(s) not found: ${files}`);
        else
          state.checkThenRunIfNoErrors(() => {
            const hashes = [];
            for (const algo of algos) {
              const hasher = Utils.hashData(algo, 'base64');
              for (const f of fs) {
                const h = hasher(FS.readFileSync(Path.resolve(state.src, f)));
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

const parse = config => {
  const
    outputCfg = config.output || {},
    src = Path.resolve(config.src || '.'),
    target = outputCfg.dir && Path.resolve(outputCfg.dir),
    state = new State(src, target);
  if (!FS.existsSync(src))
    state.errors.push(`Src dir doesn't exist: ${src}`);
  if (!config.assets)
    state.errors.push('config.assets undefined.');
  if (!target)
    state.errors.push('config.output.dir undefined.');

  if (state.ok()) {
    const
      outputNameFnDefaults = {},
      mkOutputNameFn = f => OutputName.make(f, outputNameFnDefaults),
      outputNameFn = mkOutputNameFn(config.output.name || '[basename]'),
      ctx = { state, mkOutputNameFn };

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
  }

  return state;
};

const runPlugins = cfg => Utils.tap(state => {
  if (state.ok())
    for (const p of Utils.asArray(cfg.plugins))
      if (state.ok() && p)
        p(state);
});

const generateManifest = cfg => Utils.tap(state => {
  if (state.ok()) {
    const gen = filename => {
      state.addOpWrite(filename, JSON.stringify(state.manifest, null, '  '));
    };
    const m = cfg.output.manifest;
    if (m === undefined || m === true)
      gen('manifest.json');
    else if (typeof m === 'string')
      gen(m);
    else if (m !== false)
      state.addError(`Invalid value for config.output.manifest: ${JSON.stringify(m)}`);
  }
});

const run = cfg =>
  Utils.compose([
    generateManifest(cfg),
    runPlugins(cfg)
  ])(parse(cfg));

module.exports = {
  parse,
  runPlugins,
  generateManifest,
  run,
};
