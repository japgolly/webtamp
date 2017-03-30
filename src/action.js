"use strict";

const
  FS = require('fs'),
  Path = require('path'),
  Util = require('util');

const run = ({ ops, errors, warns }, { dryRun } = {}) => {

  warns.forEach(msg => console.warn(`[WARN] ${msg}`));

  if (errors.length > 0) {
    errors.forEach(msg => console.warn(`[ERROR] ${msg}`));
  } else {

    const stats = {}
    const runner = runnerAppend([
      recordStats(stats),
      dryRun ? runnerLog : runnerPerform,
    ]);

    ops.forEach(op => runner[op.type](op));

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
    copy: op => {
      inc('files');
      add(op.from.size())('bytes');
    },
    write: op => {
      inc('files');
      add(op.content.length)('bytes');
    },
  };
}

const runnerLog = {
    copy: op => console.log(`Copy ${op.to[1]} ← ${op.from.abs}`),
    write: op => console.log(`Write ${op.to[1]} ← ${op.content.length} bytes`),
};

const runnerPerform = {
    copy: op => {},
    write: op => {},
};

const runnerAppend = runners => {
  const result = {};
  for (const k of Object.keys(runners[0]))
    result[k] = op => runners.forEach(r => r[k](op));
  return result;
}

module.exports = {
  run,
};
