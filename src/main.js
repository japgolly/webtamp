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
    else
      for (const f of fs) {
        const srcFilename = src + '/' + f;
        const contents = Utils.memoise(() => FS.readFileSync(srcFilename));
        results.ops.push({
          type: 'copy',
          from: [src, f],
          to: [target, outputNameFn({ name: f, contents })],
        });
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
