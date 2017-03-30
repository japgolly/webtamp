"use strict";

const
  Assert = require('chai').assert,
  CamelCase = require('camelcase'),
  Path = require('path'),
  Plan = require('../../src/plan'),
  Plugins = require('../../src/plugins'),
  TestData = require('../data'),
  TestUtil = require('../util');

const { src, target } = TestData;
const testPlan = TestUtil.testPlan(TestUtil.stateResultsMinusGraph);
const svgs123 = { type: 'local', files: '*{1,2,3}.svg', manifest: CamelCase };
const svg1 = { type: 'local', files: 'image1.svg', manifest: true };

describe('Plugins.Inline', () => {
  describe('data', () => {

    it('criteria function input', () => {
      const seen = [];
      const add = o => {
        const o2 = Object.assign({}, o);
        delete o2.size;
        delete o2.stat;
        seen.push(o2);
        return false;
      }
      const plugins = [Plugins.Inline.data(add)];
      const cfg = TestData.cfg({ assets: { svgs123 }, plugins });
      Plan.run(cfg);
      const expect = [1, 2, 3].map(i => ({
        manifestName: `image${i}Svg`,
        src: Path.resolve(src, `image${i}.svg`),
        dest: `image${i}.svg`,
      }));
      Assert.deepEqual(seen.sort(), expect);
    });

    it('size limit', () => {
      const plugins = [Plugins.Inline.data(i => i.size() < 1000)];
      const cfg = TestData.cfg({ assets: { svgs123 }, plugins });
      testPlan(cfg, expect => {
        expect.addOp({ type: 'copy', from: [src, 'image3.svg'], to: [target, 'image3.svg'] });
        expect.addManifestEntry('image1Svg', { url: 'data:image/svg+xml;base64,aW1hZ2UxCg==' })
        expect.addManifestEntry('image2Svg', { url: 'data:image/svg+xml;base64,aW1hZ2UyCg==' })
        expect.addManifestEntryLocal('image3Svg', '/image3.svg')
      });
    });

    it('custom mimeType', () => {
      const plugins = [Plugins.Inline.data(i => 'hello')];
      const cfg = TestData.cfg({ assets: { svg1 }, plugins });
      testPlan(cfg, expect => {
        expect.addManifestEntry('svg1', { url: 'data:hello;base64,aW1hZ2UxCg==' })
      });
    });

    it('no mimeType', () => {
      const plugins = [Plugins.Inline.data(i => '')];
      const cfg = TestData.cfg({ assets: { svg1 }, plugins });
      testPlan(cfg, expect => {
        expect.addManifestEntry('svg1', { url: 'data:base64,aW1hZ2UxCg==' })
      });
    });

  });
});
