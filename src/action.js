"use strict";

const
  FS = require('fs'),
  Path = require('path'),
  Util = require('util');

const run = ({ ops, errors, warns, manifest }, { dryRun } = {}) => {

  warns.forEach(msg => console.warn(`[WARN] ${msg}`));

  if (errors.length > 0) {
    errors.forEach(msg => console.warn(`[ERROR] ${msg}`));
  } else {

    const stats = {}
    const runner = runnerAppend([
      recordStats(stats),
      dryRun ? runnerLog : runnerPerform,
    ]);

    ops.forEach(op => runner.op[op.type](op));
    runner.manifest('manifest.json', JSON.stringify(manifest, null, '  '));

    console.info(`\nWrote ${stats.files.toLocaleString()} files; ${stats.bytes.toLocaleString()} bytes.`);
    console.info(`${warns.length} warnings.`);
  }
};

const recordStats = stats => {
  stats.files = 0;
  stats.bytes = 0;
  const add = n => k => stats[k] = stats[k] + n;
  const inc = add(1);
  return {
    op: {
      copy: op => {
        inc('files');
        add(FS.statSync(Path.resolve(op.from[0], op.from[1])).size)('bytes');
      },
      write: op => {
        inc('files');
        add(op.content.length)('bytes');
      },
    },
    manifest: (to, json) => {},
  };
}

const runnerLog = {
  op: {
    copy: op => console.log(`Copy ${op.to[1]} ← ${op.from[0]}/${op.from[1]}`),
    write: op => console.log(`Write ${op.to[1]} ← ${op.content.length} bytes`),
  },
  manifest: (to, json) => console.log(`\nWrite manifest to ${to}:\n${json}`)
};

const runnerPerform = {
  op: {
    copy: op => {},
    write: op => {},
  },
  manifest: (to, json) => console.log(`\nWrite manifest to ${to}:\n${json}`)
};

const runnerAppend = runners => {
  const mergeOp = k => op => runners.forEach(r => r.op[k](op));
  const ops = {};
  for (const k of Object.keys(runners[0].op))
    ops[k] = mergeOp(k);
  return {
    op: ops,
    manifest: (to, json) => runners.forEach(r => r.manifest(to, json)),
  };
}

module.exports = {
  run,
};
