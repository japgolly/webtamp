"use strict";

const
  fs = require('fs-extra'),
  sprintf = require('sprintf-js').sprintf,
  Path = require('path'),
  Util = require('util');

const fmtInt = n => n.toLocaleString();

const fmtPath = p => {
  const r = Path.relative(process.cwd(), p);
  return r.startsWith("../../../") ? p : r;
};

const run = ({ ops, errors, warns }, { dryRun } = {}) => {

  warns.forEach(msg => console.warn(`[WARN] ${msg}`));

  if (errors.length === 0) {
    const stats = {}
    const runner = runnerAppend([
      recordStats(stats),
      runnerLog(ops), //
      !dryRun && runnerPerform(errors), //
    ]);

    if (dryRun)
      console.info("DRY-RUN MODE. No actions will be performed.\n");

    ops.forEach((op, i) => runner[op.type](op, i + 1));

    if (ops.length > 0)
      console.info();
    console.info(`Wrote ${fmtInt(stats.files)} files comprising ${fmtInt(stats.bytes)} bytes.`);
  }

  errors.forEach(msg => console.error(`[ERROR] ${msg}`));
  console.error(`${fmtInt(warns.length)} warnings, ${fmtInt(errors.length)} errors.`);
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

const runnerLog = ops => {
  const determineColumnLength = ops => {
    const get = {
      copy: (op, _) => fmtPath(op.to.path).length,
      write: (op, _) => fmtPath(op.to.path).length,
    };
    const lens = ops.map(op => get[op.type](op));
    return lens.concat([1]).reduce((a, b) => Math.max(a, b));
  }
  const colLen = determineColumnLength(ops);
  const idxLen = (ops.length + '').length;
  const fmtIdx = `[%${idxLen}d/${ops.length}]`;
  const fmtCopy = `${fmtIdx} Copy  %-${colLen}s ← %s`;
  const fmtWrite = `${fmtIdx} Write %-${colLen}s ← %s bytes`;
  return {
    copy: (op, n) => console.log(sprintf(fmtCopy, n, fmtPath(op.to.path), fmtPath(op.from.abs))),
    write: (op, n) => console.log(sprintf(fmtWrite, n, fmtPath(op.to.path), fmtInt(op.content.length))),
  };
}

const runnerPerform = errors => ({
  copy: op => {
    const from = op.from.abs;
    const to = op.to.abs;
    try {
      fs.copySync(from, to);
    } catch (err) {
      errors.push(`Error copying ${fmtPath(from)}: ${err}`);
    }
  },
  write: op => {
    const to = op.to.abs;
    try {
      fs.outputFileSync(to, op.content);
    } catch (err) {
      errors.push(`Error creating ${fmtPath(to)}: ${err}`);
    }
  },
});

const runnerAppend = runners => {
  const rs = runners.filter(r => r);
  const result = {};
  for (const k of Object.keys(rs[0]))
    result[k] = (op, n) => rs.forEach(r => r[k](op, n));
  return result;
}

module.exports = {
  run,
};
