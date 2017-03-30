"use strict";

const
  Assert = require('chai').assert,
  Plan = require('../src/plan'),
  State = require('../src/state'),
  tap = require('../src/utils').tap;

const assertState = normaliseState => (actual, addExpectations) => {
  const expect = new State;
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
    op.from = [f.ctx, f.path];
  }),
});

const simplifyTypes = tap(r => {
  r.ops = r.ops.map(op => (simplifyOp[op.type] || identity)(op));
});

const defaultStateNormalisation = s =>
  removeGraph(simplifyTypes(s.results()));

const testPlan = (normaliseState = defaultStateNormalisation) => {
  const f = assertState(normaliseState);
  return (cfg, addExpectations) => f(Plan.run(cfg), addExpectations);
};

module.exports = {
  assertState,
  defaultStateNormalisation,
  testPlan,
}
