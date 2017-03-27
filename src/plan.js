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
function planLocal({ src, target, results, mkOutputNameFn }, name, { files, outputName, outputPath, manifest }, outputNameFn0) {
  if (!files)
    results.addError(`${name} missing key: file`);
  else {
    const fs = Glob.sync(files, { cwd: src, nodir: true });
    if (fs.length == 0)
      results.warns.push(`File(s) not found: ${value[File]}`);
    else {
      const outputNameFn = outputName ? mkOutputNameFn(outputName) : outputNameFn0;

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

function planExternal({ src, target, results, mkOutputNameFn }, name, { path, manifest }) {
  if (!path)
    results.addError(`${name} missing key: path`);
  else if (typeof(manifest) !== 'undefined')
    results.addError(`${name} is of type 'external' but contains a manifest key: ${JSON.stringify(manifest)}`);
  else
    results.addManifestEntry(name, path.replace(/^\/?/, '/'));
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

  const outputNameFn = mkOutputNameFn(config.output.name || '[basename]');

  if (results.ok())
    for (const [name, value] of Object.entries(config.assets))
      switch (value.type) {
        case 'local':
          planLocal(ctx, name, value, outputNameFn);
          break;
        case 'external':
          planExternal(ctx, name, value);
          break;
        default:
          results.addError(`${name} has invalid asset type: ${JSON.stringify(value.type)}`);
          break;
      }

  return results.toObject();
};

module.exports = {
  run
};
