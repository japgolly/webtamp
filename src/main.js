const
  FS = require('fs'),
  Glob = require("glob"),
  Path = require('path'),
  Results = require('./results'),
  Utils = require('./utils');

const mkOutputNameFn = require('./outputName');

function planLocal({ src, target, results }, name, value, outputNameFn) {
  if (value.file) {
    const fs = Glob.sync(value.file, { cwd: src, nodir: true });
    if (fs.length == 0)
      results.warns.push(`File(s) not found: ${value.file}`);
    else {
      for (const f of fs) {
        const srcFilename = src + '/' + f;
        const contents = Utils.memoise(() => FS.readFileSync(srcFilename));
        const newName = outputNameFn({ name: f, contents });
        results.addOp({
          type: 'copy',
          from: [src, f],
          to: [target, newName],
        });
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

function plan(config) {
  config.output = config.output || {};
  const
    results = new Results(),
    src = Path.resolve(config.src || '.'),
    target = Path.resolve(config.output.dir || 'target'),
    ctx = { results, src, target };
  if (!FS.existsSync(src))
    results.errors.push(`Src dir doesn't exist: ${src}`);

  const outputNameFn = mkOutputNameFn(config.output.name || '[basename]');

  if (results.ok())
    for (const [name, value] of Object.entries(config.assets))
      switch (value.type) {
        case 'local':
          planLocal(ctx, name, value, outputNameFn);
          break;
      }

  return results.toObject();
};

module.exports = {
  plan
};
