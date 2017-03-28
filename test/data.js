const Path = require('path');

// cat test/data/image1.svg | openssl dgst -sha256 -binary | openssl base64 -A

const data = {

  vizJs: { type: 'local', files: 'vendor/v?z.js', manifest: true },
  vizJsExplicit: { type: 'local', files: 'vendor/v?z.js', manifest: 'vizJs' },

  image1SvgSha256: 'sha256-A/Q7jy5ivY2cPMuPnY+LJpxE7xyEJhPi5UchebJAaVA=',
  image2SvgSha256: 'sha256-iN39iYUkBuORbiinlAfVZAPIrV558O7KzRSzSP0aZng=',
  image2SvgSha384: 'sha384-MY1+aNx3EQM6G5atTiVuZcv6x2a+erMjYoaEH7WPHA6CpuihomIrPuqDHpL48fWI',

  jqueryUrl: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js',

  src: Path.resolve(__dirname, 'data'),
  target: '/tmp/tool-thingy',
  cfg: o => Object.assign({ src: data.src, output: { dir: data.target } }, o || {}),
};

module.exports = data;
