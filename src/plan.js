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
 * @param  {OutputNameFn}                      outputNameFn0
 * @param  {Bool}                              inArray
 * @param  {String}                            name
 * @param  {String}                            files
 * @param  {NameTemplate?}                     outputName
 * @param  {String?}                           outputPath
 * @param  {Bool | Path => Maybe ManifestName} manifest
 */
const planLocal =
  ({ src, target, results, mkOutputNameFn }, outputNameFn0) => inArray =>
  (name, { files, outputName, outputPath, manifest }) => {
    if (!files)
      results.addError(`${name} missing key: file`);
    else if (manifest === true && inArray)
      results.addError(`${name} has {manifest: true} but requires an explicit name or function.`);
    else {
      const fs = Glob.sync(files, { cwd: src, nodir: true });
      if (fs.length == 0)
        results.addWarn(`File(s) not found: ${value[File]}`);
      else {
        const outputNameFn = outputName ? mkOutputNameFn(outputName) : outputNameFn0;
        results.registerNow(name);

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
              if (fs.length > 1)
                results.addWarn(`${name} has {manifest: true} but '${files}' matches more than 1 file.`);
              else
                add(name);
            } else if (typeof manifest === 'string')
              add(manifest);
            else {
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
      results.registerNow(name);
      results.addManifestEntry(name, path.replace(/^\/?/, '/'));
    }
  }

const planRef = ({ results }) => (name, refName) => {
  results.addDependency(name, refName);
}

const foldAsset = (results, cases) => {
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
        default:
          results.addError(`${name} has invalid asset type: ${JSON.stringify(value.type)}`);
      }
    else
      results.addError(`${name} has an invalid value: ${JSON.stringify(value)}`);
  };
  return go(false);
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
      string: _ => planRef(ctx),
      local: planLocal(ctx, outputNameFn),
      external: _ => planExternal(ctx),
    }

    // Parse config.optional
    {
      const o = config.optional;
      if (o) {
        const defer = f => inArray => (n, v) => {
          results.registerForLater(n, () => f(inArray)(n, v));
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

    // Resolve required, pending deps
    {
      const loop = () => {
        // This seems stupid, lazy way of doing it but it's been too long a day so meh
        const changed = [false];
        for (const [name, deps] of Object.entries(results.deps))
          for (const dep of deps) {
            if (results.deps[dep]) {
              // Already registered - do nothing
            } else if (results.pending[dep]) {
              const fns = results.pending[dep];
              results.pending[dep] = undefined;
              fns.forEach(fn => fn());
              changed[0] = true;
            } else {
              results.addError(`${name} referenced an unspecified asset: ${dep}`);
            }
          }
        return changed[0];
      }
      while (loop());
    }

    // Graph dependencies
    if (results.ok()) {
      const graph = {};
      const add = n => {
        if (graph[n] === undefined) {

          graph[n] = null;
          const deps = results.deps[n] || [];
          deps.forEach(add);
          graph[n] = {};
          deps.forEach(d => graph[n][d] = graph[d]);
          Object.freeze(graph[n]);

        } else if (graph[n] === null) {
          results.addError(`Circular dependency on asset: ${n}`)
        }
      };
      Object.keys(results.deps).forEach(add);
      Object.freeze(graph);
      // if (results.ok())
      //   console.log(graph);
    }
  }

  return results.toObject();
};

module.exports = {
  run
};
