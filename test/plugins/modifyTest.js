"use strict";

const
  Assert = require('chai').assert,
  Plan = require('../../dist/plan'),
  Plugins = require('../../dist/plugins'),
  TestData = require('../data'),
  TestUtil = require('../util');

const { assertManifest } = TestUtil
const { src, target, jqueryCdnM, jqueryUrlEntry, jqueryManifestEntry } = TestData;

describe('Plugins.Modify', () => {

  describe('replaceWebtampUrls', () => {

    it("replaces urls in site.webmanifest", () => {

      const cfg = {
        src,
        output: { dir: target },
        assets: {
          image1: { type: 'local', files: 'image1.svg', outputName: 'omg-wow-mah-1-image.svg', manifest: true },
          image2: { type: 'local', files: 'image2.svg', outputName: '[hash:32].[ext]', manifest: true },
          siteman: { type: 'local', files: 'site.webmanifest' },
        },
        plugins: [
          Plugins.Modify.replaceWebtampUrls({
            testFilename: /^site/,
            urlQuotes: [`'`, `"`],
          })
        ]
      }
      const state = Plan.run(cfg)
      // console.log(JSON.stringify(state.ops, null, 2))
      Assert.deepEqual(state.errors, []);

      const expectedContent = `{
  "name": "",
  "short_name": "",
  "icons": [
      {
          "src": "/omg-wow-mah-1-image.svg",
          "sizes": "192x192",
          "type": "image/png"
      },
      {
          "src": "/88ddfd89852406e3916e28a79407d564.svg",
          "sizes": "512x512",
          "type": "image/png"
      }
  ],
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "display": "standalone"
}
`
      TestUtil.assertWriteOp(state.ops,"site.webmanifest", expectedContent)
    })
  })

  describe('rename', () => {

    const makeCfg = o =>
      Object.assign({}, { src, target, output: { dir: target, name: 'copy-[basename]', manifest: false } }, o);

    it("affects type: local", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js' } } })
      cfg.plugins = [Plugins.Modify.rename(/^copy-/, f => f.substring(5))];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js' }] });
      assertManifest(state.manifest, {entries: {}});
    });

    it("affects type: local with manifest", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', manifest: 'wow' } } })
      cfg.plugins = [Plugins.Modify.rename(/^copy-/, f => f.substring(5))];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js' }] });
      assertManifest(state.manifest, {entries: { wow: { local: '/hello.js' } }});
    });

    it("uses specified filename test", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', manifest: 'wow' } } })
      cfg.plugins = [Plugins.Modify.rename(/nope/, f => "nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/copy-hello.js' }] });
      assertManifest(state.manifest, {entries: { wow: { local: '/copy-hello.js' } }});
    });

    it("ignores type: cdn", () => {
      const cfg = makeCfg({ assets: { hello: jqueryCdnM } })
      cfg.plugins = [Plugins.Modify.rename(/.js$/, f => f + ".nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [jqueryUrlEntry] });
      assertManifest(state.manifest, {entries: { hello: jqueryManifestEntry }});
    });

    it("ignores type: external", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'external', path: '/thing.js', manifest: 'wow' } } })
      cfg.plugins = [Plugins.Modify.rename(/.js$/, f => f + ".nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/thing.js' }] });
      assertManifest(state.manifest, {entries: { wow: { local: '/thing.js' } }});
    });

    it("ignores transitive assets", () => {
      const cfg = makeCfg({ assets: { hello: { type: 'local', files: 'hello.js', transitive: true } } })
      cfg.plugins = [Plugins.Modify.rename(/hello/, _ => "nope")];
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      Assert.deepEqual(state.urls, { hello: [{ url: '/hello.js', transitive: true }] });
      assertManifest(state.manifest, {entries: {}});
    });

  });
});
