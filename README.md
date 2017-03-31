# webtamp [![Build Status](https://travis-ci.org/japgolly/webtamp.svg?branch=master)](https://travis-ci.org/japgolly/webtamp)

webtamp is bundler for assets.
It is inspired by webpack, and meant to be a companion to JS-driven bundlers like webpack.

You can do a lot of cool and useful things with webpack and its plugin community.
However, there are a number of things that either can't be done at all,
or can be done poorly and with difficulty by plugin that hack webpack in a way it wasn't meant for.
The webpack authors are very clear about the scope and boundaries of webpack and fair enough.

webtamp exists to address the gap.
It does all the things I need to do for my webapp's assets, after I've used webpack.

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
       dir: "dist",
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

# Examples

TODO

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
