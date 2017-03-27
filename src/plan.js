const
  FS = require('fs'),
  Glob = require("glob"),
  OutputName = require('./outputName'),
  Path = require('path'),
  Results = require('./results'),
  Utils = require('./utils');

/**
 * @param  {String}                            src
 * @param  {String}                            target
 * @param  {Results}                           results
 * @param  {NameTemplate => OutputNameFn}      mkOutputNameFn
 * @param  {String}                            name
 * @param  {String}                            files
 * @param  {NameTemplate?}                     outputName
 * @param  {String?}                           outputPath
 * @param  {Bool | Path => Maybe ManifestName} manifest
 * @param  {OutputNameFn}                      outputNameFn0
 */
const planLocal =
  ({ src, target, results, mkOutputNameFn }, outputNameFn0) =>
  (name, { files, outputName, outputPath, manifest }) => {

    if (!files)
      results.addError(`${name} missing key: file`);
    else {
      const fs = Glob.sync(files, { cwd: src, nodir: true });
      if (fs.length == 0)
        results.warns.push(`File(s) not found: ${value[File]}`);
      else {
        const outputNameFn = outputName ? mkOutputNameFn(outputName) : outputNameFn0;
        results.registerTerminal(name);

        // Add each local file
        for (const f of fs) {
          const srcFilename = src + '/' + f;
          const contents = Utils.memoise(() => FS.readFileSync(srcFilename));
          let newName = outputNameFn({ name: f, contents });
          if (outputPath)
            newName = `${outputPath}/${newName}`;

          // Copy file
          results.addOp({
            type: 'copy',
            from: [src, f],
            to: [target, newName],
          });

          // Add to manifest
          if (manifest) {
            const add = n => results.addManifestEntry(n, '/' + newName);
            if (manifest === true) {
              if (fs.length == 1)
                add(name);
              else
                results.addWarn(`${name} has manifest: true but '${files}' matches more than 1 file.`);
            } else {
              const manifestName = manifest(f);
              if (manifestName)
                add(manifestName);
            }
          }
        }
      }
    }
  }

const planExternal =
  ({ src, target, results, mkOutputNameFn }) =>
  (name, { path, manifest }) => {
    if (!path)
      results.addError(`${name} missing key: path`);
    else if (typeof(manifest) !== 'undefined')
      results.addError(`${name} is of type 'external' but contains a manifest key: ${JSON.stringify(manifest)}`);
    else {
      results.registerTerminal(name);
      results.addManifestEntry(name, path.replace(/^\/?/, '/'));
    }
  }

const planRef = ({ results }) => (name, refName) => {
  results.addDependency(name, refName);
}

const foldAsset = (results, cases) => {
  const go = (name, value) => {
    if (Array.isArray(value))
      for (v of value) go(name, v);
    else if (typeof value === 'string')
      cases.string(name, value);
    else if (typeof value === 'object')
      switch (value.type) {
        case 'local':
          return cases.local(name, value);
        case 'external':
          return cases.external(name, value);
        default:
          results.addError(`${name} has invalid asset type: ${JSON.stringify(value.type)}`);
      }
    else
      results.addError(`${name} has an invalid value: ${JSON.stringify(value)}`);
  };
  return go;
}

function run(config) {
  config.output = config.output || {};
  const
    results = new Results(),
    src = Path.resolve(config.src || '.'),
    target = Path.resolve(config.output.dir || 'target'),
    outputNameFnDefaults = {},
    mkOutputNameFn = f => OutputName.make(f, outputNameFnDefaults),
    ctx = { results, src, target, mkOutputNameFn };
  if (!FS.existsSync(src))
    results.errors.push(`Src dir doesn't exist: ${src}`);
  if (typeof(config.assets) === 'undefined')
    results.errors.push('config.assets undefined.');

  const outputNameFn = mkOutputNameFn(config.output.name || '[basename]');

  if (results.ok()) {

    const cases = {
      string: planRef(ctx),
      local: planLocal(ctx, outputNameFn),
      external: planExternal(ctx),
    }

    // Parse config.optional
    {
      const o = config.optional;
      if (o) {
        const defer = f => (n, v) => {
          results.registerForLater(n, () => f(n, v));
        }
        const casesDeferred = Utils.mapObjectValues(cases, defer);
        const add = foldAsset(results, casesDeferred);
        for (const [name, value] of Object.entries(o))
          add(name, value);
      }
    }

    // Parse config.assets
    {
      const add = foldAsset(results, cases);
      for (const [name, value] of Object.entries(config.assets))
        add(name, value);
    }

    // Graph dependencies
    {
      for (const [name, deps] of Object.entries(results.deps))
        for (const dep of deps) {
          if (results.deps[dep]) {
            // Already registered - do nothing
          } else if (results.pending[dep]) {
            const fn = results.pending[dep];
            results.pending[dep] = undefined;
            fn();
          } else {
            results.addError(`${name} referenced an unspecified asset: ${dep}`);
          }

        }
    }
  }

  return results.toObject();
};

module.exports = {
  run
};
