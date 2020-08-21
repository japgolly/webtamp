"use strict";

const
  Assert = require('chai').assert,
  Plan = require('../dist/plan'),
  State = require('../dist/state'),
  tap = require('../dist/utils').tap;

function assertManifest(actual, expect) {
  Assert.deepEqual(Object.assign({}, actual), expect)
}

const assertState = normaliseState => (actual, addExpectations) => {
  const expect = new State(actual.src, actual.target);
  addExpectations(expect);
  const e = normaliseState(expect);
  const a = normaliseState(actual);
  Assert.deepEqual(a, e);
  return a;
};

const identity = a => a;

const removeGraph = tap(r => delete r.graph);

const simplifyOp = ({
  copy: tap(op => {
    const f = op.from;
    const t = op.to;
    op.from = [f.ctx, f.path];
    op.to = [t.ctx, t.path];
  }),
  write: tap(op => {
    const t = op.to;
    delete op.originallyFrom;
    op.to = [t.ctx, t.path];
  }),
});

const simplifyOpArray = ops =>
  ops.map(op => (simplifyOp[op.type] || identity)(op));

const simplifyTypes = tap(r => {
  r.ops = simplifyOpArray(r.ops);
});

const defaultStateNormalisation = s =>
  removeGraph(simplifyTypes(s.results()));

const testPlan = (normaliseState = defaultStateNormalisation) => {
  const f = assertState(normaliseState);
  return (cfg, addExpectations) => f(Plan.run(cfg), addExpectations);
};

const assertOps = (ops, opCriteria, expect, normalise) => {
  const normArray = normalise ? ops => ops.map(normalise) : identity;
  const actual = simplifyOpArray(normArray(ops.filter(opCriteria))).sort();
  Assert.deepEqual(actual, normArray(expect).sort());
}

module.exports = {
  assertManifest,
  assertOps,
  assertState,
  defaultStateNormalisation,
  testPlan,
}
