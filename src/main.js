"use strict";

const
  Action = require('./action'),
  Plan = require('./plan');

function run(cfg, { dryRun = false } = {}) {
  const plan = Plan.run(cfg);
  Action.run(plan, { dryRun });
};

module.exports = {
  plugins: require('./plugins'),
  run,
};
