const
  Assert = require('chai').assert,
  OutputName = require('../src/outputName'),
  Path = require('path'),
  Plan = require('../src/plan'),
  Results = require('../src/results');

const
  vizJs = { type: 'local', file: 'vendor/v?z.js', manifest: true },
  reactJs1 = { type: 'local', file: 'react1.js' },
  reactJs2 = { type: 'local', file: 'react2.js' },
  svgs = { type: 'local', file: '*.svg', manifest: f => f.replace(/\.svg$/, 'Svg') },
  src = Path.resolve(__dirname, 'data'),
  target = '/tmp/tool-thingy';

describe('Plan', () => {
  describe('run', () => {

    function assertResults(cfg, addExpectations) {
      const expect = new Results;
      addExpectations(expect);
      Assert.deepEqual(Plan.run(cfg), expect.toObject());
    };

    it('local', () => {
      const cfg = {
        src,
        output: { dir: target },
        assets: { vizJs },
      };
      assertResults(cfg, expect => {
        expect.addOp({
          type: 'copy',
          from: [src, 'vendor/viz.js'],
          to: [target, 'viz.js']
        });
        expect.addManifestEntry('vizJs', '/viz.js')
      })
    });

    it('local, no manifest', () => {
      const cfg = {
        src,
        output: { dir: target },
        assets: { vizJs: { type: 'local', file: 'vendor/v?z.js' } },
      };
      assertResults(cfg, expect => {
        expect.addOp({
          type: 'copy',
          from: [src, 'vendor/viz.js'],
          to: [target, 'viz.js']
        });
      });
    });

    it('local with hashed filename', () => {
      const cfg = {
        src,
        output: { dir: target, name: '[hash].[ext]' },
        assets: { vizJs },
      };
      assertResults(cfg, expect => {
        expect.addOp({
          type: 'copy',
          from: [src, 'vendor/viz.js'],
          to: [target, 'e4e91995e194dd59cafba1c0dad576c6.js']
        });
        expect.addManifestEntry('vizJs', '/e4e91995e194dd59cafba1c0dad576c6.js')
      });
    });

    it('local files with manifest fn', () => {
      const cfg = {
        src,
        output: { dir: target },
        assets: { svgs },
      };
      assertResults(cfg, expect => {
        for (const i of [1, 2]) {
          const f = `image${i}.svg`;
          expect.addOp({ type: 'copy', from: [src, f], to: [target, f] });
          expect.addManifestEntry(`image${i}Svg`, '/' + f)
        }
      });
    });

    it('local files with manifest fn and outputPath', () => {
      const cfg = {
        src,
        output: { dir: target },
        assets: {
          svgs: Object.assign({ outputPath: 'img' }, svgs)
        },
      };
      assertResults(cfg, expect => {
        for (const i of [1, 2]) {
          const f = `image${i}.svg`;
          expect.addOp({ type: 'copy', from: [src, f], to: [target, 'img/' + f] });
          expect.addManifestEntry(`image${i}Svg`, '/img/' + f)
        }
      });
    });

    it('local files with manifest fn and outputName', () => {
      const cfg = {
        src,
        output: { dir: target },
        assets: {
          svgs: Object.assign({ outputName: '[hash].[ext]' }, svgs)
        },
      };
      assertResults(cfg, expect => {
        const hashes = ['03f43b8f2e62bd8d9c3ccb8f9d8f8b26', '88ddfd89852406e3916e28a79407d564'];
        for (const i of [1, 2]) {
          const fi = `image${i}.svg`;
          const fo = `${hashes[i-1]}.svg`;
          expect.addOp({ type: 'copy', from: [src, fi], to: [target, fo] });
          expect.addManifestEntry(`image${i}Svg`, '/' + fo)
        }
      });
    });

    it('external', () => {
      const cfg = {
        src,
        output: { dir: target },
        assets: {
          extA: { type: 'external', path: 'a.js' },
          extB: { type: 'external', path: '/b.js' },
        },
      };
      assertResults(cfg, expect => {
        expect.addManifestEntry("extA", '/a.js');
        expect.addManifestEntry("extB", '/b.js');
      });
    });

  });
});
