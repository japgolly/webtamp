const
  Assert = require('chai').assert,
  OutputName = require('../src/outputName'),
  Path = require('path'),
  Main = require('../src/main'),
  Results = require('../src/results');

const vizJs = { type: 'local', file: 'vendor/v?z.js', manifest: true };
const reactJs1 = { type: 'local', file: 'react1.js' };
const reactJs2 = { type: 'local', file: 'react2.js' };
const svgs = { type: 'local', file: '*.svg', manifest: f => f.replace(/\.svg$/, 'Svg') };

describe('mkOutputNameFn', () => {
  const i = { name: 'y/hi.txt', contents: () => "12345678" }
  it("should replace [basename]", () => {
    const fn = OutputName.make("x/[basename]");
    Assert.equal(fn(i), "x/hi.txt")
  })
  it("should replace [name] & [ext]", () => {
    const fn = OutputName.make("[name]-hehe.[ext]");
    Assert.equal(fn(i), "hi-hehe.txt")
  })
  it("should replace [path]", () => {
    const fn = OutputName.make("[path]/123");
    Assert.equal(fn(i), "y/123")
  })
  it("should replace [md5]", () => {
    const fn = OutputName.make("[md5].[ext]");
    Assert.equal(fn(i), "25d55ad283aa400af464c76d713c07ad.txt")
  })
  it("should replace [sha256]", () => {
    const fn = OutputName.make("[sha256].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f.txt")
  })
  it("should replace [sha256:16]", () => {
    const fn = OutputName.make("[sha256:16].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb.txt")
  })
  it("should replace [hash]", () => {
    const fn = OutputName.make("[hash].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb649607dd5d3f8c76.txt")
  })
  it("should replace [hash:16]", () => {
    const fn = OutputName.make("[hash:16].[ext]");
    Assert.equal(fn(i), "ef797c8118f02dfb.txt")
  })
});

const
  src = Path.resolve(__dirname, 'data'),
  target = '/tmp/tool-thingy';

const assertResults = (cfg, addExpectations) => {
  const expect = new Results;
  addExpectations(expect);
  Assert.deepEqual(Main.plan(cfg), expect.toObject());
};

describe('main()', () => {

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

});
