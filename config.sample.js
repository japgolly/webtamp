export default {

  // src: ".",

  output: {
    // dir: "target",
    // name: '[basename]', // NameTemplate
    // manifest: 'manifest.json', // Bool | String
  },

  assets: {

    name: {
      type: 'local',
      files: 'images/**/*.{png,jpg}',
      // manifest: false,       // Bool | Path => Maybe ManifestName
      // src: undefined,        // String
      // outputPath: undefined, // String
      // outputName: undefined, // NameTemplate
    }

    name: {
      type: 'external',
      path: 'whatever.js',
      // manifest: false,       // Bool | Path => Maybe ManifestName
    },

    name: {
      type: 'cdn',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js',
      // integrity: 'sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=',
      // integrity: {
      //   files: 'node_modules/jquery/dist/jquery.min.js', // Pattern | Array Pattern
      //   algo: 'sha256', // String | Array String
      // },
      // crossorigin: "anonymous",
      // manifest: false,       // Bool | Url => Maybe ManifestName
    },

    name: "asset name",

    name: [any value types used above],
  },

  optional: {
    // same as 'assets' above
  },

  plugins: [
    // State => Unit
  ]
}
