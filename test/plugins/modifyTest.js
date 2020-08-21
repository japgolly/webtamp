"use strict";

const
  Assert = require('chai').assert,
  Plan = require('../../dist/plan'),
  Plugins = require('../../dist/plugins'),
  TestData = require('../data');

const { src, target, jqueryCdnM, jqueryUrlEntry, jqueryManifestEntry } = TestData;

describe('Plugins.Modify', () => {
  describe('rename', () => {

    const makeCfg = o =>
      Object.assign({}, { src, target, output: { dir: target, name: 'copy-[basename]', manifest: false } }, o);

    it("affects type: local", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js' } } })
      cfg.plugins = [Plugins.Modify.rename(/^copy-/, f => f.substring(5))];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js' }] });
      Assert.deepEqual(state.manifest, {entries: {}});
    });

    it("affects type: local with manifest", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', manifest: 'wow' } } })
      cfg.plugins = [Plugins.Modify.rename(/^copy-/, f => f.substring(5))];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js' }] });
      Assert.deepEqual(state.manifest, {entries: { wow: { local: '/hello.js' } }});
    });

    it("uses specified filename test", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', manifest: 'wow' } } })
      cfg.plugins = [Plugins.Modify.rename(/nope/, f => "nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/copy-hello.js' }] });
      Assert.deepEqual(state.manifest, {entries: { wow: { local: '/copy-hello.js' } }});
    });

    it("ignores type: cdn", () => {
      const cfg = makeCfg({ assets: { hello: jqueryCdnM } })
      cfg.plugins = [Plugins.Modify.rename(/.js$/, f => f + ".nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [jqueryUrlEntry] });
      Assert.deepEqual(state.manifest, {entries: { hello: jqueryManifestEntry }});
    });

    it("ignores type: external", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'external', path: '/thing.js', manifest: 'wow' } } })
      cfg.plugins = [Plugins.Modify.rename(/.js$/, f => f + ".nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/thing.js' }] });
      Assert.deepEqual(state.manifest, {entries: { wow: { local: '/thing.js' } }});
    });

    it("ignores transitive assets", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', transitive: true } } })
      cfg.plugins = [Plugins.Modify.rename(/hello/, _ => "nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js', transitive: true }] });
      Assert.deepEqual(state.manifest, {entries: {}});
    });

  });
});
