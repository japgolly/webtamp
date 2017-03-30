const
  Assert = require('chai').assert,
  FS = require('fs'),
  Path = require('path'),
  Plan = require('../src/plan'),
  ModifyPlugin = require('../src/modify'),
  TestData = require('./data'),
  TestUtil = require('./util'),
  Utils = require('../src/utils');

const { src, target, jqueryCdn, jqueryUrlEntry, jqueryManifestEntry } = TestData;

describe('Modify plugin', () => {
  describe('rename', () => {

    const makeCfg = o =>
      Object.assign({}, { src, target, output: { name: 'copy-[basename]' } }, o);

    it("affects type: local", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js' } } })
      cfg.plugins = [ModifyPlugin.rename(/^copy-/, f => f.substring(5))];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js' }] });
      Assert.deepEqual(state.manifest, {});
    });

    it("affects type: local with manifest", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', manifest: 'wow' } } })
      cfg.plugins = [ModifyPlugin.rename(/^copy-/, f => f.substring(5))];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js' }] });
      Assert.deepEqual(state.manifest, { wow: { local: '/hello.js' } });
    });

    it("uses specified filename test", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', manifest: 'wow' } } })
      cfg.plugins = [ModifyPlugin.rename(/nope/, f => "nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/copy-hello.js' }] });
      Assert.deepEqual(state.manifest, { wow: { local: '/copy-hello.js' } });
    });

    it("ignores type: cdn", () => {
      const cfg = makeCfg({ assets: { hello: jqueryCdn } })
      cfg.plugins = [ModifyPlugin.rename(/.js$/, f => f + ".nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [jqueryUrlEntry] });
      Assert.deepEqual(state.manifest, { hello: jqueryManifestEntry });
    });

    it("ignores type: external", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'external', path: '/thing.js', manifest: 'wow' } } })
      cfg.plugins = [ModifyPlugin.rename(/.js$/, f => f + ".nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/thing.js' }] });
      Assert.deepEqual(state.manifest, { wow: { local: '/thing.js' } });
    });

  });
});