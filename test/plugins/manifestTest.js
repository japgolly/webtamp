"use strict";

const
  Assert = require('chai').assert,
  CamelCase = require('camelcase'),
  Plan = require('../../dist/plan'),
  Plugins = require('../../dist/plugins'),
  TestData = require('../data'),
  TestUtil = require('../util');

const { assertManifest } = TestUtil
const { target, vizJs, jqueryCdnM, css1, css2 } = TestData;

const wwJs = { type: 'external', path: '/ww.js', manifest: true };

describe('Plugins.Manifest', () => {

  describe('extractCss', () => {
    it("extracts URLs from CSS to make a new manifest entry", () => {
      const cfg = TestData.cfg({
        assets: { css1 },
        plugins: [ Plugins.Manifest.extractCss({}) ],
      });
      const state = Plan.run(cfg);
      assertManifest(state.manifest, {entries: {
        css1: { local: '/1.css' },
        css1Urls: { list: [
          'https://fonts.googleapis.com/css?family=Lato:400,700,400italic,700italic&subset=latin',
          'icons.eot',
          'icons.eot?#iefix',
          'icons.woff2',
          'icons.woff',
          'icons.ttf',
          'icons.svg#icons',
        ]},
      }});
    });
  });

  describe('generate.scala', () => {

    it("generates a Scala manifest", () => {
      const cfg = TestData.cfg({
        assets: {
          vizJs,
          svgs: { type: 'local', files: '*{1,2}.svg', manifest: CamelCase },
          wwJs,
          css1, css2,
          jquery: jqueryCdnM,
        },
        plugins: [
          Plugins.Inline.data(i => /image2/.test(i.dest)),
          Plugins.Manifest.extractCss({}),
          Plugins.Manifest.generate.scala({ object: "demo.test.Manifest" }),
        ],
      });
      const filename = "Manifest.scala"
      cfg.output.name = "[name]-[hash:16].[ext]";
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      // console.log(state.ops[4].content)
      TestUtil.assertOps(state.ops, op => op.type === 'write' && op.to.path === filename, [{
        type: 'write',
        to: [target, filename],
        content: `
package demo.test

/** Generated by webtamp. */
object Manifest {

  final case class CDN(href: String, integrity: Option[String])

  def css1 = "/1-24299309df91abd8.css"

  def css1Urls: List[String] =
    "https://fonts.googleapis.com/css?family=Lato:400,700,400italic,700italic&subset=latin" ::
    "icons.eot" ::
    "icons.eot?#iefix" ::
    "icons.woff2" ::
    "icons.woff" ::
    "icons.ttf" ::
    "icons.svg#icons" ::
    Nil

  def css2 = "/2-469d3cc8794b9f5a.css"

  def css2Urls: List[String] =
    Nil

  def image1Svg = "/image1-03f43b8f2e62bd8d.svg"

  def image2Svg = "data:image/svg+xml;base64,aW1hZ2UyCg=="

  def jquery = CDN(
    href = "https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js",
    integrity = Some("sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44="))

  def vizJs = "/viz-e4e91995e194dd59.js"

  def wwJs = "/ww.js"
}
        `.trim()
      }]);
    });

    it("generates an abstract Scala manifest", () => {
      const cfg = TestData.cfg({
        assets: {
          vizJs,
          svgs: { type: 'local', files: '*{1,2}.svg', manifest: CamelCase },
          wwJs,
          css1, css2,
          jquery: jqueryCdnM,
        },
        plugins: [
          Plugins.Inline.data(i => /image2/.test(i.dest)),
          Plugins.Manifest.extractCss({}),
          Plugins.Manifest.generate.scala({ abstract: true, object: "demo.test.Manifest" }),
        ],
      });
      const filename = "Manifest.scala"
      cfg.output.name = "[name]-[hash:16].[ext]";
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      // console.log(state.ops[4].content)
      TestUtil.assertOps(state.ops, op => op.type === 'write' && op.to.path === filename, [{
        type: 'write',
        to: [target, filename],
        content: `
package demo.test

/** Generated by webtamp. */
object Manifest {
  final case class CDN(href: String, integrity: Option[String])
}

abstract class Manifest[+A] {
  import Manifest._

  protected def modify(f: String): A

  final val css1 = modify("/1-24299309df91abd8.css")

  final val css1Urls: List[A] =
    modify("https://fonts.googleapis.com/css?family=Lato:400,700,400italic,700italic&subset=latin") ::
    modify("icons.eot") ::
    modify("icons.eot?#iefix") ::
    modify("icons.woff2") ::
    modify("icons.woff") ::
    modify("icons.ttf") ::
    modify("icons.svg#icons") ::
    Nil

  final val css2 = modify("/2-469d3cc8794b9f5a.css")

  final val css2Urls: List[A] =
    Nil

  final val image1Svg = modify("/image1-03f43b8f2e62bd8d.svg")

  final val image2Svg = modify("data:image/svg+xml;base64,aW1hZ2UyCg==")

  final val jquery = CDN(
    href = "https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js",
    integrity = Some("sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44="))

  final val vizJs = modify("/viz-e4e91995e194dd59.js")

  final val wwJs = modify("/ww.js")
}
        `.trim()
      }]);
    });

    it("respects options: outputPath, filename", () => {
      const outputPath = "omg"
      const filename = "Hi.scala"
      const cfg = TestData.cfg({
        assets: { wwJs },
        plugins: [ Plugins.Manifest.generate.scala({ object: "hehe.Hi", outputPath, filename }) ],
      });
      const state = Plan.run(cfg);
      Assert.deepEqual(state.errors, []);
      TestUtil.assertOps(state.ops, _ => true, [{
        type: 'write',
        to: [target, `${outputPath}/${filename}`],
        content: `
package hehe

/** Generated by webtamp. */
object Hi {

  def wwJs = "/ww.js"
}
        `.trim()
      }]);
    });

  });
});
