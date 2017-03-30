"use strict";

const
  Assert = require('chai').assert,
  Plan = require('../src/plan'),
  State = require('../src/state');

const assertState = normaliseState => (actual, addExpectations) => {
  const expect = new State;
  addExpectations(expect);
  const e = normaliseState(expect);
  const a = normaliseState(actual);
  Assert.deepEqual(a, e);
  return a;
};

const stateResultsMinusGraph = s => {
  const o = s.results()
  o.graph = undefined;
  return o;
};

const testPlan = normaliseState => {
  const f = assertState(normaliseState)
  return (cfg, addExpectations) => f(Plan.run(cfg), addExpectations);
};

module.exports = {
  assertState,
  stateResultsMinusGraph,
  testPlan,
}
