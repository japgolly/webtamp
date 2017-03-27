const
  FS = require('fs'),
  Glob = require("glob"),
  OutputName = require('./outputName'),
  Path = require('path'),
  Results = require('./results'),
  Utils = require('./utils');

function planLocal({ src, target, results, mkOutputNameFn }, name, value, outputNameFn0) {
  if (!value.file)
    results.addError(`${name} missing key: file`);
  else {
    const fs = Glob.sync(value.file, { cwd: src, nodir: true });
    if (fs.length == 0)
      results.warns.push(`File(s) not found: ${value.file}`);
    else {
      const outputNameFn = value.outputName ? mkOutputNameFn(value.outputName) : outputNameFn0;

      // Add each local file
      for (const f of fs) {
        const srcFilename = src + '/' + f;
        const contents = Utils.memoise(() => FS.readFileSync(srcFilename));
        let newName = outputNameFn({ name: f, contents });
        if (value.outputPath)
          newName = `${value.outputPath}/${newName}`;

        // Copy file
        results.addOp({
          type: 'copy',
          from: [src, f],
          to: [target, newName],
        });

        // Add to manifest
        if (value.manifest) {
          const add = n => results.addManifestEntry(n, '/' + newName);
          if (value.manifest === true) {
            if (fs.length == 1)
              add(name);
            else
              results.addWarn(`${name} has manifest: true but '${value.file}' matches more than 1 file.`);
          } else {
            const manifestName = value.manifest(f);
            if (manifestName)
              add(manifestName);
          }
        }
      }
    }
  }
}

function planExternal({ src, target, results, mkOutputNameFn }, name, value) {
  if (!value.path)
    results.addError(`${name} missing key: path`);
  else {
    results.addManifestEntry(name, value.path.replace(/^\/?/, '/'));
  }
}

function plan(config) {
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
  plan
};
