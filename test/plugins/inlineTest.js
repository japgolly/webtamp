"use strict";

const
  Assert = require('chai').assert,
  CamelCase = require('camelcase'),
  Path = require('path'),
  Plan = require('../../dist/plan'),
  Plugins = require('../../dist/plugins'),
  TestData = require('../data'),
  TestUtil = require('../util'),
  LocalSrc = require('../../dist/utils').LocalSrc;

const { src, target } = TestData;
const testPlan = TestUtil.testPlan();
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
        expect.addOpCopy(new LocalSrc(src, 'image3.svg'), 'image3.svg');
        expect.manifest.addUrl('image1Svg', 'data:image/svg+xml;base64,aW1hZ2UxCg==')
        expect.manifest.addUrl('image2Svg', 'data:image/svg+xml;base64,aW1hZ2UyCg==')
        expect.manifest.addPathLocal('image3Svg', '/image3.svg')
      });
    });

    it('custom mimeType', () => {
      const plugins = [Plugins.Inline.data(i => 'hello')];
      const cfg = TestData.cfg({ assets: { svg1 }, plugins });
      testPlan(cfg, expect => {
        expect.manifest.addUrl('svg1', 'data:hello;base64,aW1hZ2UxCg==')
      });
    });

    it('no mimeType', () => {
      const plugins = [Plugins.Inline.data(i => '')];
      const cfg = TestData.cfg({ assets: { svg1 }, plugins });
      testPlan(cfg, expect => {
        expect.manifest.addUrl('svg1', 'data:base64,aW1hZ2UxCg==' )
      });
    });

    it('works on new content after a content modification', () => {
      const plugins = [
        Plugins.Modify.content(/\.svg$/, c => "hello"),
        Plugins.Inline.data(i => i.size() == 5)
        // Plugins.Inline.data(i => {console.log(`size = ${i.size()}`,i); return i.size() == 5})
      ];
      const cfg = TestData.cfg({ assets: { svg1 }, plugins });
      testPlan(cfg, expect => {
        expect.manifest.addUrl('svg1', 'data:image/svg+xml;base64,aGVsbG8=')
      });
    });

  });
});
