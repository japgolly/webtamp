"use strict";

const
  Assert = require('chai').assert,
  Plan = require('../dist/plan'),
  State = require('../dist/state').default,
  tap = require('../dist/utils').tap,
  TestData = require('./data');

function assertManifest(actual, expect) {
  const a = Object.assign({}, actual)
  delete a.state
  Assert.deepEqual(a, expect)
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

const removeManifestState = m => {
  const o = Object.assign({}, m)
  delete o.manifest.state
  return o
};

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
  removeGraph(simplifyTypes(removeManifestState(s.results())));

const testPlan = (normaliseState = defaultStateNormalisation) => {
  const f = assertState(normaliseState);
  return (cfg, addExpectations) => f(Plan.run(cfg), addExpectations);
};

const assertOps = (ops, opCriteria, expect, normalise) => {
  const normArray = normalise ? ops => ops.map(normalise) : identity;
  const actual = simplifyOpArray(normArray(ops.filter(opCriteria))).sort();
  Assert.deepEqual(actual, normArray(expect).sort());
}

const assertWriteOp = (ops, toPath, expectedContent, normalise) => {
  assertOps(ops, op => op.to.path === toPath, [{
    type: 'write',
    to: [TestData.target, toPath],
    content: expectedContent,
  }], normalise)
}

module.exports = {
  assertManifest,
  assertOps,
  assertWriteOp,
  assertState,
  defaultStateNormalisation,
  testPlan,
}
