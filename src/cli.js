#!/usr/bin/env node

const
  commander = require('commander'),
  FS = require('fs'),
  Path = require('path'),
  Webtamp = require('./main');

commander
  .version(require(__dirname + '/../package.json').version)
  .option('-c, --config [path]', 'Path to the config file', 'webtamp.config.js')
  .option('-n, --dryrun', "Run without making any modifications. Log actions instead of performing them.")
  .parse(process.argv);

const configFile = Path.resolve(process.cwd(), commander.config);
if (!(configFile && FS.existsSync(configFile))) {
  console.error("File not found: " + configFile);
  process.exit(1);
}
const config = require(configFile);

const options = {
  dryRun: commander.dryrun,
}

const s = Webtamp.run(config, options);
process.exit(s.ok() ? 0 : 2);
