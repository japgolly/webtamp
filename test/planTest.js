const
  Assert = require('chai').assert,
  OutputName = require('../src/outputName'),
  Path = require('path'),
  Plan = require('../src/plan'),
  State = require('../src/state');

const
  vizJs = { type: 'local', files: 'vendor/v?z.js', manifest: true },
  vizJsExplicit = { type: 'local', files: 'vendor/v?z.js', manifest: 'vizJs' },
  svgs = { type: 'local', files: '*.svg', manifest: f => f.replace(/\.svg$/, 'Svg') },
  src = Path.resolve(__dirname, 'data'),
  target = '/tmp/tool-thingy';

function addSvgExpectations(expect) {
  for (const i of [1, 2]) {
    const f = `image${i}.svg`;
    expect.addOp({ type: 'copy', from: [src, f], to: [target, f] });
    expect.addManifestEntry(`image${i}Svg`, '/' + f)
  }
}

describe('Plan', () => {
  describe('run', () => {

    function assertState(cfg, addExpectations) {
      const expect = new State;
      addExpectations(expect);
      const norm = o => {
        o.graph = undefined;
        return o;
      }
      const e = norm(expect.results());
      const a = norm(Plan.run(cfg));
      Assert.deepEqual(a, e);
    };

    describe('local', () => {

      it('simple', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs },
        };
        assertState(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntry('vizJs', '/viz.js')
        })
      });

      it('no manifest', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', files: 'vendor/v?z.js' } },
        };
        assertState(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
        });
      });

      it('manifest string', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', files: 'vendor/v?z.js', manifest: 'omgJs' } },
        };
        assertState(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntry('omgJs', '/viz.js')
        });
      });

      it('manifest: true in array = error', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: [vizJs] },
        };
        assertState(cfg, expect => {
          expect.addError('vizJs has {manifest: true} but requires an explicit name or function.')
        });
      });

      it('hashed filename', () => {
        const cfg = {
          src,
          output: { dir: target, name: '[hash].[ext]' },
          assets: { vizJs },
        };
        assertState(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'e4e91995e194dd59cafba1c0dad576c6.js']
          });
          expect.addManifestEntry('vizJs', '/e4e91995e194dd59cafba1c0dad576c6.js')
        });
      });

      it('manifest fn', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { svgs },
        };
        assertState(cfg, expect => {
          addSvgExpectations(expect);
        });
      });

      it('manifest fn and outputPath', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            svgs: Object.assign({ outputPath: 'img' }, svgs)
          },
        };
        assertState(cfg, expect => {
          for (const i of [1, 2]) {
            const f = `image${i}.svg`;
            expect.addOp({ type: 'copy', from: [src, f], to: [target, 'img/' + f] });
            expect.addManifestEntry(`image${i}Svg`, '/img/' + f)
          }
        });
      });

      it('manifest fn and outputName', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            svgs: Object.assign({ outputName: '[hash].[ext]' }, svgs)
          },
        };
        assertState(cfg, expect => {
          const hashes = ['03f43b8f2e62bd8d9c3ccb8f9d8f8b26', '88ddfd89852406e3916e28a79407d564'];
          for (const i of [1, 2]) {
            const fi = `image${i}.svg`;
            const fo = `${hashes[i-1]}.svg`;
            expect.addOp({ type: 'copy', from: [src, fi], to: [target, fo] });
            expect.addManifestEntry(`image${i}Svg`, '/' + fo)
          }
        });
      });
    });

    describe('external', () => {
      it('manifest name from asset name', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            extA: { type: 'external', path: 'a.js' },
            extB: { type: 'external', path: '/b.js' },
          },
        };
        assertState(cfg, expect => {
          expect.addManifestEntry("extA", '/a.js');
          expect.addManifestEntry("extB", '/b.js');
        });
      });

      it('explicit manifest names', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            exts: [
              { type: 'external', path: 'a.js', manifest: 'extA' },
              { type: 'external', path: 'b.js', manifest: 'extB' },
            ],
          },
        };
        assertState(cfg, expect => {
          expect.addManifestEntry("extA", '/a.js');
          expect.addManifestEntry("extB", '/b.js');
        });
      });

      it('manifest names required', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            exts: [
              { type: 'external', path: 'a.js' },
              { type: 'external', path: 'b.js' },
            ],
          },
        };
        assertState(cfg, expect => {
          expect.addError("exts:a.js requires an explicit manifest name because it's in an array.");
          expect.addError("exts:b.js requires an explicit manifest name because it's in an array.");
        });
      });

      it('error if manifest setting not a string', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            extA: { type: 'external', path: 'a.js', manifest: false },
            extB: { type: 'external', path: 'b.js', manifest: f => f },
          },
        };
        assertState(cfg, expect => {
          expect.addError("extA has an invalid manifest: false");
          expect.addError("extB has an invalid manifest: undefined");
        });
      });

    });

    describe('optional', () => {
      it('ignored when not referenced', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {},
          optional: { vizJs },
        };
        assertState(cfg, expect => {});
      });
    });

    describe('dependencies', () => {

      [
        ['optional', 'vizJs'],
        ['same optional twice', ['vizJs', 'vizJs']],
      ].map(([testName, assetValue]) => {
        it('main → ' + testName, () => {
          const cfg = {
            src,
            output: { dir: target },
            assets: { omg: assetValue },
            optional: { vizJs },
          };
          assertState(cfg, expect => {
            expect.addOp({ type: 'copy', from: [src, 'vendor/viz.js'], to: [target, 'viz.js'] });
            expect.addManifestEntry('vizJs', '/viz.js');
          });
        });
      });

      it('cycle: self-reference', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { omg: 'omg' },
        };
        assertState(cfg, expect => {
          expect.addError('Circular dependency on asset: omg');
        });
      });

      it('cycle: a↔b', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { a: 'b', b: 'a' },
        };
        assertState(cfg, expect => {
          expect.addError('Circular dependency on asset: a');
        });
      });
    });

    describe('multi-feature', () => {
      it('example #1', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            a: 'b',
            m: [svgs, 'n'],
          },
          optional: {
            x: { type: 'external', path: 'x' }, // not referenced
            b: ['c'],
            c: ['d', 'e', 'm'],
            d: [vizJsExplicit, 'e'],
            e: 'f',
            f: { type: 'external', path: 'f' },
            n: [{ type: 'external', path: 'n', manifest: 'n' }]
          },
        };
        assertState(cfg, expect => {
          addSvgExpectations(expect);
          expect.addOp({ type: 'copy', from: [src, 'vendor/viz.js'], to: [target, 'viz.js'] });
          expect.addManifestEntry('vizJs', '/viz.js');
          expect.addManifestEntry('f', '/f');
          expect.addManifestEntry('n', '/n');
        });
      });
    });

  });
});
