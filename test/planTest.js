const
  Assert = require('chai').assert,
  OutputName = require('../src/outputName'),
  Path = require('path'),
  Plan = require('../src/plan'),
  State = require('../src/state');

// cat test/data/image1.svg | openssl dgst -sha256 -binary | openssl base64 -A

const
  vizJs = { type: 'local', files: 'vendor/v?z.js', manifest: true },
  vizJsExplicit = { type: 'local', files: 'vendor/v?z.js', manifest: 'vizJs' },
  svgs = { type: 'local', files: '*.svg', manifest: f => f.replace(/\.svg$/, 'Svg') },
  image1SvgSha256 = 'sha256-A/Q7jy5ivY2cPMuPnY+LJpxE7xyEJhPi5UchebJAaVA=',
  image2SvgSha256 = 'sha256-iN39iYUkBuORbiinlAfVZAPIrV558O7KzRSzSP0aZng=',
  image2SvgSha384 = 'sha384-MY1+aNx3EQM6G5atTiVuZcv6x2a+erMjYoaEH7WPHA6CpuihomIrPuqDHpL48fWI',
  src = Path.resolve(__dirname, 'data'),
  target = '/tmp/tool-thingy';

function addSvgExpectations(expect) {
  for (const i of [1, 2]) {
    const f = `image${i}.svg`;
    expect.addOp({ type: 'copy', from: [src, f], to: [target, f] });
    expect.addManifestEntryLocal(`image${i}Svg`, '/' + f)
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
      return a;
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
          expect.addManifestEntryLocal('vizJs', '/viz.js')
        })
      });

      it('with src', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', src: 'vendor', files: 'v?z.js', manifest: true } },
        };
        assertState(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src + '/vendor', 'viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntryLocal('vizJs', '/viz.js')
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
          expect.addManifestEntryLocal('omgJs', '/viz.js')
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
          expect.addManifestEntryLocal('vizJs', '/e4e91995e194dd59cafba1c0dad576c6.js')
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
            expect.addManifestEntryLocal(`image${i}Svg`, '/img/' + f)
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
            expect.addManifestEntryLocal(`image${i}Svg`, '/' + fo)
          }
        });
      });
    });

    function testManifestRequiredInArray(valueA, valueB, subname, okA, okB) {
      Object.freeze(valueA);
      Object.freeze(valueB);

      it('manifest name from asset name', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { extA: valueA, extB: valueB },
        };
        assertState(cfg, expect => {
          okA(expect, "extA");
          okB(expect, "extB");
        });
      });

      it('explicit manifest names', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            exts: [
              Object.assign({ manifest: 'extA' }, valueA),
              Object.assign({ manifest: 'extB' }, valueB),
            ],
          },
        };
        assertState(cfg, expect => {
          okA(expect, "extA");
          okB(expect, "extB");
        });
      });

      it('manifest names required', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { exts: [valueA, valueB] },
        };
        assertState(cfg, expect => {
          expect.addError(`exts:${subname(valueA)} requires an explicit manifest name because it's in an array.`);
          expect.addError(`exts:${subname(valueB)} requires an explicit manifest name because it's in an array.`);
        });
      });

      it('error if manifest setting not a string', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            extA: Object.assign({ manifest: false }, valueA),
            extB: Object.assign({ manifest: f => f }, valueB),
          },
        };
        assertState(cfg, expect => {
          expect.addError("extA has an invalid manifest: false");
          expect.addError("extB has an invalid manifest: undefined");
        });
      });
    };

    describe('external', () => {
      const a = { type: 'external', path: 'a.js' };
      const b = { type: 'external', path: '/b.js' };
      const okA = (expect, name) => expect.addManifestEntryLocal(name, '/a.js');
      const okB = (expect, name) => expect.addManifestEntryLocal(name, '/b.js');
      testManifestRequiredInArray(a, b, i => i.path, okA, okB);
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
            expect.addManifestEntryLocal('vizJs', '/viz.js');
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

    describe('cdn', () => {
      const url = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js';

      const test = (def, expectFn) => {
        const cfg = { src, output: { dir: target }, assets: { x: Object.assign({ type: 'cdn' }, def) } };
        assertState(cfg, expectFn);
      };

      const testOk = (def, out) => test(def, expect => expect.addManifestEntryCdn('x', out));
      const testErr = (def, err) => test(def, expect => expect.addError(err));

      it('integrity specified', () => {
        const integrity = 'sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT4‌​4=';
        testOk({ url, integrity }, { url, integrity });
      });

      it('integrity from file', () => {
        testOk( //
          { url, integrity: { files: 'image2.svg' } }, //
          { url, integrity: image2SvgSha256 });
      });

      it('integrity from multiple files', () => {
        testOk( //
          { url, integrity: { files: 'image?.svg' } }, //
          { url, integrity: `${image1SvgSha256} ${image2SvgSha256}` });
      });

      it('integrity with different algorithm', () => {
        testOk( //
          { url, integrity: { files: 'image2.svg', algo: 'sha384' } }, //
          { url, integrity: image2SvgSha384 });
      });

      it('integrity with multiple algorithms', () => {
        testOk( //
          { url, integrity: { files: 'image2.svg', algo: ['sha384', 'sha256'] } }, //
          { url, integrity: `${image2SvgSha384} ${image2SvgSha256}` });
      });

      it('error when no integrity', () => {
        testErr({ url }, 'x missing key: integrity');
      });

      it('error when no url', () => {
        testErr({ integrity: image2SvgSha256 }, 'x missing key: url');
      });

      it('error when no files match', () => {
        testErr( //
          { url, integrity: { files: 'whatever.js' } }, //
          'x integrity file(s) not found: whatever.js');
      });

      const url2 = 'https://unpkg.com/react@15.3.1/dist/react.min.js';
      const a = { type: 'cdn', url: url, integrity: image1SvgSha256 };
      const b = { type: 'cdn', url: url2, integrity: image2SvgSha256 };
      const okA = (expect, name) => expect.addManifestEntryCdn(name, { url: url, integrity: image1SvgSha256 });
      const okB = (expect, name) => expect.addManifestEntryCdn(name, { url: url2, integrity: image2SvgSha256 });
      testManifestRequiredInArray(a, b, i => i.url, okA, okB);
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
          expect.addManifestEntryLocal('vizJs', '/viz.js');
          expect.addManifestEntryLocal('f', '/f');
          expect.addManifestEntryLocal('n', '/n');
        });
        // console.log(Plan.run(cfg));
      });
    });

  });
});
