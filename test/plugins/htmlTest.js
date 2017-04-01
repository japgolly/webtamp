"use strict";

const
  Assert = require('chai').assert,
  FS = require('fs'),
  Path = require('path'),
  Plan = require('../../src/plan'),
  Plugins = require('../../src/plugins'),
  TestData = require('../data'),
  TestUtil = require('../util'),
  Utils = require('../../src/utils');

const { src, target, jqueryCdn, bootstrapCssCdn } = TestData;

const page1Content = FS.readFileSync(src + "/page1.html").toString();
const requireTag = '<require asset="chosen" />';

function prepPage1(cfg) {
  const c = TestData.cfg(cfg);
  c.output.name = 'out-[basename]';
  c.assets.page1 = { type: 'local', files: 'page1.html' };
  if (!c.plugins) c.plugins = [Plugins.Html.replace()];
  return c;
}

function testPage1(cfg, expectedReplacement, { expectMod = e => e, replace = true } = {}) {
  const state = Plan.run(prepPage1(cfg));
  Assert.deepEqual(state.errors, []);
  const to = 'out-page1.html';
  let expect = page1Content;
  if (replace)
    expect = expect.replace(requireTag, expectedReplacement);
  expect = expectMod(expect);
  const norm = i => {
    const o = Object.assign({}, i);
    o.content = o.content.split("\n")
    return o;
  }
  TestUtil.assertOps(state.ops, op => op.to.path === to, [{
    type: 'write',
    to: [target, to],
    content: expect,
  }], norm);
}

function testError(expectedErrors, cfg, cfgMod) {
  const c = prepPage1(cfg);
  if (cfgMod) cfgMod(c);
  const state = Plan.run(c);
  Assert.deepEqual(state.errors, Utils.asArray(expectedErrors).map(e => `page1.html: ${e}`));
}

const choseLocal = o => Object.assign({}, { assets: { chosen: { type: 'local', files: 'hello.js' } } }, o || {});

describe('Plugins.Html.replace', () => {
  describe('<require>', () => {

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
      testError("<require/> tag needs an 'asset' attribute.", cfg);
    });

    it('error when invalid asset name', () => {
      const modStr = s => s.replace('chosen', 'nope');
      const modPlugin = Plugins.Modify.content(/\.html$/, modStr);
      const cfg = choseLocal({ plugins: [modPlugin, Plugins.Html.replace()] });
      testError("Asset referenced in <require/> not found: nope", cfg);
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
      testError("Don't know what kind of HTML tag is needed to load: /out-hello.js.what", cfg);
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
  // TODO favicon

});
