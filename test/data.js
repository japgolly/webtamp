"use strict";

const Path = require('path');

// cat test/data/image1.svg | openssl dgst -sha256 -binary | openssl base64 -A

const data = {

  css1: { type: 'local', files: '1.css', manifest: 'css1' },
  css2: { type: 'local', files: '2.css', manifest: 'css2' },

  vizJs: { type: 'local', files: 'vendor/v?z.js', manifest: true },
  vizJsExplicit: { type: 'local', files: 'vendor/v?z.js', manifest: 'vizJs' },

  image1SvgSha256: 'sha256-A/Q7jy5ivY2cPMuPnY+LJpxE7xyEJhPi5UchebJAaVA=',
  image2SvgSha256: 'sha256-iN39iYUkBuORbiinlAfVZAPIrV558O7KzRSzSP0aZng=',
  image2SvgSha384: 'sha384-MY1+aNx3EQM6G5atTiVuZcv6x2a+erMjYoaEH7WPHA6CpuihomIrPuqDHpL48fWI',

  jqueryCdn: Object.freeze({
    type: 'cdn',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js',
    integrity: 'sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT4‌​4=',
  }),

  bootstrapCssCdn: Object.freeze({
    type: 'cdn',
    url: 'https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-alpha.6/css/bootstrap.min.css',
    integrity: 'sha384-rwoIResjU2yc3z8GV/NPeZWAv56rSmLldC3R/AZzGRnGxQQKnKkoFVhFQhNUwEyJ',
  }),

  src: Path.resolve(__dirname, 'data'),
  target: '/tmp/tool-thingy',
  cfg: o => Object.assign({ src: data.src, output: { dir: data.target, manifest: false } }, o || {}),
};

data.jqueryUrl = data.jqueryCdn.url;

data.jqueryCdnM = Object.assign({manifest: true}, data.jqueryCdn);

data.jqueryManifestEntry = Object.freeze({
  cdn: {
    url: data.jqueryCdn.url,
    integrity: data.jqueryCdn.integrity,
  }
});

data.jqueryUrlEntry = Object.freeze({
  url: data.jqueryCdn.url,
  integrity: data.jqueryCdn.integrity,
  crossorigin: 'anonymous',
});

Object.freeze(data);

module.exports = data;
