const
  Assert = require('chai').assert,
  Path = require('path'),
  Main = require('../src/main'),
  Results = require('../src/results');

const mkOutputNameFn = require('../src/outputName');

const vizJs = { type: 'local', file: 'vendor/v?z.js', manifest: true };
const reactJs1 = { type: 'local', file: 'react1.js' };
const reactJs2 = { type: 'local', file: 'react2.js' };

describe('mkOutputNameFn', () => {
  const i = { name: 'y/hi.txt', contents: () => "12345678" }
  it("should replace [basename]", () => {
    const fn = mkOutputNameFn("x/[basename]");
    Assert.equal(fn(i), "x/hi.txt")
  })
  it("should replace [name] & [ext]", () => {
    const fn = mkOutputNameFn("[name]-hehe.[ext]");
    Assert.equal(fn(i), "hi-hehe.txt")
  })
  it("should replace [path]", () => {
    const fn = mkOutputNameFn("[path]/123");
    Assert.equal(fn(i), "y/123")
  })
  it("should replace [md5]", () => {
    const fn = mkOutputNameFn("[md5].[ext]");
    Assert.equal(fn(i), "25d55ad283aa400af464c76d713c07ad.txt")
  })
  it("should replace [sha256]", () => {
    const fn = mkOutputNameFn("[sha256].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f.txt")
  })
  it("should replace [sha256:16]", () => {
    const fn = mkOutputNameFn("[sha256:16].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb.txt")
  })
  it("should replace [hash]", () => {
    const fn = mkOutputNameFn("[hash].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb649607dd5d3f8c76.txt")
  })
  it("should replace [hash:16]", () => {
    const fn = mkOutputNameFn("[hash:16].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb.txt")
  })
});

const
  src = Path.resolve(__dirname, 'data'),
  target = '/tmp/tool-thingy';

describe('main()', () => {

  it('local', () => {
    const
      cfg = {
        src,
        output: { dir: target },
        assets: { vizJs },
      },
      expect = new Results;
    expect.addOp({
      type: 'copy',
      from: [src, 'vendor/viz.js'],
      to: [target, 'viz.js']
    });
    expect.addManifestEntry('vizJs', '/viz.js')
    Assert.deepEqual(Main.plan(cfg), expect.toObject());
  });

  it('local, no manifest', () => {
    const
      cfg = {
        src,
        output: { dir: target },
        assets: { vizJs: { type: 'local', file: 'vendor/v?z.js' } },
      },
      expect = new Results;
    expect.addOp({
      type: 'copy',
      from: [src, 'vendor/viz.js'],
      to: [target, 'viz.js']
    });
    Assert.deepEqual(Main.plan(cfg), expect.toObject());
  });

  it('local with hashed filename', () => {
    const
      cfg = {
        src,
        output: { dir: target, name: '[hash].[ext]' },
        assets: { vizJs },
      },
      expect = new Results;
    expect.addOp({
      type: 'copy',
      from: [src, 'vendor/viz.js'],
      to: [target, 'e4e91995e194dd59cafba1c0dad576c6.js']
    });
    expect.addManifestEntry('vizJs', '/e4e91995e194dd59cafba1c0dad576c6.js')
    Assert.deepEqual(Main.plan(cfg), expect.toObject());
  });

  it('local files with manifest fn', () => {
    const
      cfg = {
        src,
        output: { dir: target },
        assets: {
          svgs: { type: 'local', file: '*.svg', manifest: f => f.replace(/\.svg$/, 'Svg') }
        },
      },
      expect = new Results;
    for(const i of [1, 2]) {
      const f = `image${i}.svg`;
      expect.addOp({ type: 'copy', from: [src, f], to: [target, f] });
      expect.addManifestEntry(`image${i}Svg`, '/' + f)
    }
    Assert.deepEqual(Main.plan(cfg), expect.toObject());
  });

});
