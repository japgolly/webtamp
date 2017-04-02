"use strict";

const
  Assert = require('chai').assert,
  CamelCase = require('camelcase'),
  FS = require('fs'),
  Path = require('path'),
  Plan = require('../../src/plan'),
  Plugins = require('../../src/plugins'),
  TestData = require('../data'),
  TestUtil = require('../util'),
  Utils = require('../../src/utils');

const { src, target, jqueryCdn, bootstrapCssCdn } = TestData;

const testPage = (cfg, expectedContent, to) => {
  const state = Plan.run(cfg);
  Assert.deepEqual(state.errors, []);
  const norm = i => {
    const o = Object.assign({}, i);
    o.content = o.content.split("\n")
    return o;
  }
  TestUtil.assertOps(state.ops, op => op.to.path === to, [{
    type: 'write',
    to: [target, to],
    content: expectedContent,
  }], norm);
}

const makePageTest = n => {
  const p = {};
  p.src = `page${n}.html`;
  p.prep = cfg => {
    const c = TestData.cfg(cfg);
    c.output.name = 'out-[basename]';
    if (!c.assets) c.assets = {};
    c.assets.test = { type: 'local', files: p.src };
    if (!c.plugins) c.plugins = [Plugins.Html.replace()];
    return c;
  };
  p.content = FS.readFileSync(`${src}/${p.src}`).toString();
  p.test = (cfg, expectedContent) => testPage(
    p.prep(cfg),
    typeof expectedContent === 'function' ? expectedContent(p.content) : expectedContent,
    `out-${p.src}`);
  p.testError = (expectedErrors, cfg, cfgMod) => {
    const c = p.prep(cfg);
    if (cfgMod) cfgMod(c);
    const state = Plan.run(c);
    Assert.deepEqual(state.errors, Utils.asArray(expectedErrors).map(e => `${p.src}: ${e}`));
  }
  return p;
};
const pageTest = [undefined].concat([1, 2, 3].map(makePageTest));

const requireTag = '<require asset="chosen" />';

function testPage1(cfg, expectedReplacement, { expectMod = e => e, replace = true } = {}) {
  pageTest[1].test(cfg, c =>
    expectMod(replace ? c.replace(requireTag, expectedReplacement) : c));
}

const choseLocal = o => Object.assign({}, { assets: { chosen: { type: 'local', files: 'hello.js' } } }, o || {});

describe('Plugins.Html', () => {
  describe('replace', () => {
    describe('<require asset="…" />', () => {

      it('link to JS: local', () => {
        const cfg = choseLocal();
        const exp = '<script src="/out-hello.js"></script>'
        testPage1(cfg, exp)
      });

      it('link to JS: external', () => {
        const cfg = { assets: { chosen: { type: 'external', path: '/thing.js' } } };
        const exp = '<script src="/thing.js"></script>'
        testPage1(cfg, exp)
      });

      it('link to JS: cdn', () => {
        const cfg = { assets: { chosen: jqueryCdn } };
        const exp = `<script src="${jqueryCdn.url}" integrity="${jqueryCdn.integrity}" crossorigin="anonymous"></script>`;
        testPage1(cfg, exp)
      });

      it('link to CSS', () => {
        const cfg = { assets: { chosen: bootstrapCssCdn } };
        const exp = `<link rel="stylesheet" href="${bootstrapCssCdn.url}" integrity="${bootstrapCssCdn.integrity}" crossorigin="anonymous">`;
        testPage1(cfg, exp)
      });

      it('loads dependencies in order', () => {
        const cfg = {
          assets: {
            chosen: ['d', { type: 'local', files: 'hello.js' }, 'c'],
          },
          optional: {
            a: ['z', { type: 'external', path: '/a.css', manifest: 'a_css' }],
            b: { type: 'external', path: '/b.js' },
            c: [{ type: 'external', path: '/c.js', manifest: 'c_js' }, 'b', 'z'],
            d: ['a'],
            z: { type: 'external', path: '/z.js' },
          },
        };
        const exps = [
          '<script src="/z.js"></script>', // chosen -> c -> a -> z
          '<link rel="stylesheet" href="/a.css">', // chosen -> a
          '<script src="/b.js"></script>', // chosen -> c -> b
          '<script src="/c.js"></script>', // chosen -> c
          '<script src="/out-hello.js"></script>', // chosen
        ];
        testPage1(cfg, exps.join("\n"))
      });

      it('works on "write" ops', () => {
        const modStr = s => s.replace(/Page 1/g, 'PAGE ONE!!!');
        const modPlugin = Plugins.Modify.content(/\.html$/, modStr);
        const cfg = choseLocal({ plugins: [modPlugin, Plugins.Html.replace()] });
        const exp = '<script src="/out-hello.js"></script>'
        testPage1(cfg, exp, { expectMod: modStr })
      });

      it('error when asset attribute missing', () => {
        const modStr = s => s.replace(' asset="chosen"', '');
        const modPlugin = Plugins.Modify.content(/\.html$/, modStr);
        const cfg = choseLocal({ plugins: [modPlugin, Plugins.Html.replace()] });
        pageTest[1].testError("<require/> tag needs an 'asset' attribute.", cfg);
      });

      it('error when invalid asset name', () => {
        const modStr = s => s.replace('chosen', 'nope');
        const modPlugin = Plugins.Modify.content(/\.html$/, modStr);
        const cfg = choseLocal({ plugins: [modPlugin, Plugins.Html.replace()] });
        pageTest[1].testError("Asset referenced in <require/> not found: nope", cfg);
      });

      it('follows renames', () => {
        const modPlugin = Plugins.Modify.rename(/\.js$/, f => "renamed-" + f);
        const cfg = choseLocal({ plugins: [modPlugin, Plugins.Html.replace()] });
        const exp = '<script src="/renamed-out-hello.js"></script>';
        testPage1(cfg, exp);
      });

      it('error when file type unrecognised', () => {
        const modPlugin = Plugins.Modify.rename(/\.js$/, f => f + ".what");
        const cfg = choseLocal({ plugins: [modPlugin, Plugins.Html.replace()] });
        pageTest[1].testError("Don't know what kind of HTML tag is needed to load: /out-hello.js.what", cfg);
      });

      it('ignores transitive dependencies', () => {
        const cfg = {
          assets: {
            v: { type: 'local', files: 'vendor/v?z.js', transitive: true },
            h: { type: 'local', files: 'hello.js' },
            chosen: ['v', 'h'],
          }
        };
        const exp = '<script src="/out-hello.js"></script>'
        testPage1(cfg, exp)
      });

      describe('<require manifest="…" />', () => {

        it('link to JS: local', () => {
          const cfg = { assets: { x: { type: 'local', files: 'hello.js', manifest: 'chooseMe' } } };
          const exp = '<script src="/out-hello.js"></script>';
          const expect = c => c.replace('<require manifest="chooseMe" />', exp);
          pageTest[3].test(cfg, expect);
        });

        // TODO Test other types (CDN loses its integrity due to State.manifestUrl)
      });

      describe("webtamp: //manifest:", () => {
        it('replace with local url', () => {
          const cfg = { assets: { x: { type: 'local', files: '*.svg', manifest: CamelCase } } };
          const expect = c => c
            .replace('webtamp://manifest/image1Svg', '/out-image1.svg')
            .replace('webtamp://manifest/image2Svg', '/out-image2.svg');
          pageTest[2].test(cfg, expect);
        });
        it('error when no manifest entry', () => {
          const cfg = { assets: { x: { type: 'local', files: '*.svg' } } };
          pageTest[2].testError([1, 2].map(i => `Manifest entry not found: image${i}Svg`), cfg);
        });
      });
    });
  });

  describe("minify", () => {
    const minify = Plugins.Html.minify({ options: { removeComments: true, collapseWhitespace: true } });
    const expMin = e => e.replace(/\n\s*|<!-- Why hello there -->/g, '').replace('sen" /', 'sen"');
    it("minifies HTML", () => {
      const cfg = { assets: {}, plugins: [minify] };
      testPage1(cfg, null, { expectMod: expMin, replace: false });
    });
    it("minifies after repalcement", () => {
      const cfg = choseLocal({ plugins: [Plugins.Html.replace(), minify] });
      const exp = '<script src="/out-hello.js"></script>'
      testPage1(cfg, exp, { expectMod: expMin });
    });
  });
});
