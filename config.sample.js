export default {

  // src: ".",

  output: {
    // dir: "target",
    // name: '[basename]', // NameTemplate
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
      // manifest: undefined, // String
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
      // manifest: undefined, // String
    },

    name: "asset name",

    name: [any value types used above],
  },

  optional: {
    // same as 'assets' above
  },
}
