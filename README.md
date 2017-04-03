# webtamp [![Build Status](https://travis-ci.org/japgolly/webtamp.svg?branch=master)](https://travis-ci.org/japgolly/webtamp) [![npm](https://img.shields.io/npm/v/webtamp.svg)](https://www.npmjs.com/package/webtamp)

webtamp is bundler for assets.
It is inspired by webpack, and meant to be a companion to JS-driven bundlers like webpack.

You can do a lot of cool and useful things with webpack and its plugin community.
However, there are a number of things that either can't be done at all,
or can be done poorly and with difficulty by plugin that hack webpack in a way it wasn't meant for.
The webpack authors are very clear about the scope and boundaries of webpack and fair enough.

webtamp exists to address the gap.
It does all the things I need to do for my webapp's assets, after I've used webpack.

### Contents
- [Features](#features)
- [Usage](#usage)
- [Plugins](#plugins)
- [Example](#example)
- [Legal](#legal)

# Features

* Anything can be a top-level asset. No JS loader required or generated.
* Dynamic filenames with hashing options.
* Easy to integrate non-module based libraries, including those that expect relative assets with precise names.
* CDNs supported directly.
  * Integrity can be specified manually.
  * Integrity can be calculated from local files.
* Inliner plugin to inline assets (usually with size < n) into `data:` URIs.
* Generate URL manifests.
  * Formats can be JSON and Scala.
  * Configure what is/isn't included in the manifest, and the names of entries.
  * Includes inlined assets.
* HTML integration
  * Replaces `<require asset="name" />` with tags that load the asset, and all of its dependencies in order.
  * Loads from CDN and locally-served assets alike.
* Assets can be optional and will only be included when referenced (with transitivity).
* Plugin system.

# Usage

1. Install.

    ```
    npm install --save-dev webtamp
    ```

2. Create a config file, default name is `webtamp.config.js`.

   For details on all available options, see [doc/config.sample.js](doc/config.sample.js).

   A good starting point with commonly-used would be:

   ```js
   const webtamp = require('webtamp');

   module.exports = {

     output: {
       dir: 'dist',
       name: '[name]-[hash].[ext]',
     },

     assets: {
       // mandatory assets go here
     },

     optional: {
       // optional assets go here
     },

     plugins: [
     ],
   };
   ```

3. Run it.

    ```
    ./node_modules/.bin/webtamp
    ```

    Or if you named your config file differently:
    ```
    ./node_modules/.bin/webtamp --config <file>
    ```

    There's also a dry-run mode so no one gets hurt:
    ```
    ./node_modules/.bin/webtamp [--config <file>] --dryrun
    ```

# Plugins

* `webtamp.plugins.Modify.content` - Modify certain files' content.
* `webtamp.plugins.Modify.rename` - Modify rename certain files.
* `webtamp.plugins.Modify.{stateful,stateless}` - Modify files' names and content with more control.
* `webtamp.plugins.Inline.data` - For files that given criteria, exclude from output and replace with a data URI.
* `webtamp.plugins.Html.replace` - Replace `<require>` tags and `webtamp://` URIs with real asset tags/links. Missing assets will fail the build.
* `webtamp.plugins.Html.minify` - Minify HTML.

# Example

This will demonstrate a number of features. Not all but enough to be useful.

Say you have a tree of files like:
```
example
├── node_modules
│   ├── jquery
│   │   └── dist
│   │       └── jquery.min.js
│   └── katex
│       └── dist
│           ├── fonts
│           │   ├── KaTeX_Size1-Regular.eot
│           │   ├── KaTeX_Size1-Regular.ttf
│           │   ├── KaTeX_Size1-Regular.woff
│           │   └── KaTeX_Size1-Regular.woff2
│           ├── katex.min.css
│           └── katex.min.js
├── src
│   ├── assets
│   │   ├── tiny.svg
│   │   └── welcome.svg
│   └── html
│       └── index.html
└── vendor
    └── blerb.js
```

And a webtamp config like:
```js
const camelcase = require('camelcase');
const webtamp = require('webtamp');

module.exports = {

  output: {
    dir: 'dist',
    name: '[hash:8]-[name].[ext]',
  },

  assets: {
    html: { type: 'local', src: 'src/html', files: '**/*.html', outputName: '[path]/[basename]' },
    images: { type: 'local', src: 'src/assets', files: '**/*.{svg,ico}', manifest: camelcase },
    main: [ 'blerb', 'katex' ],
  },

  optional: {

    jquery: {
      type: 'cdn',
      url: `https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js`,
      integrity: { files: 'node_modules/jquery/dist/jquery.min.js' },
    },

    blerb: [
      { type: 'local', files: 'vendor/blerb.js', manifest: true },
      'jquery', // This here means blerb requires jquery
    ],

    katex: [
      { type: 'local', src: 'node_modules/katex/dist', files: '*.min.js' },
      { type: 'local', src: 'node_modules/katex/dist', files: 'fonts/**/*', transitive: true },
    ],
  },

  plugins: [
    Webtamp.plugins.Inline.data(i => /\.svg$/.test(i.dest) && i.size() < 4096),
    Webtamp.plugins.Html.replace(),
  ],
}
```

Now lets say the content of your `src/html/index.html` is as follows:
```html
<html>
  <head>
    <!-- *********** ↓ replaces this ↓ *********** -->
    <require asset="main" />
  </head>
  <body>
    <!-- *********** ↓ replaces these ↓ *********** -->
    <img src="webtamp://manifest/tinySvg" alt="Tiny!">
    <img src="webtamp://manifest/welcomeSvg" alt="Welcome!">
  </body>
</html>
```

After running webtamp, you'll have a `dist` directory like this:
```
dist
├── 03bef6aa-katex.min.js
├── 1b40ddd6-katex.min.css
├── 5eb3a560-welcome.svg
├── 88fee037-blerb.js
├── fonts
│   ├── KaTeX_Size1-Regular.eot
│   ├── KaTeX_Size1-Regular.ttf
│   ├── KaTeX_Size1-Regular.woff
│   └── KaTeX_Size1-Regular.woff2
└── index.html
```

And the `dist/index.html` after the `Html.replace` plugin now looks like this:
```html
<html>
  <head>
    <!-- *********** ↓ replaces this ↓ *********** -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
    <script src="/88fee037-blerb.js"></script>
    <script src="/03bef6aa-katex.min.js"></script>
    <link  href="/1b40ddd6-katex.min.css" rel="stylesheet">
  </head>
  <body>
    <!-- *********** ↓ replaces these ↓ *********** -->
    <img src="data:image/svg+xml;base64,VGhpcyBpcyBqdXN0IGFuIGV4YW1wbGUK" alt="Tiny!">
    <img src="/5eb3a560-welcome.svg" alt="Welcome!">
  </body>
</html>
```


# Legal

```
Copyright 2017 David Barri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
