export default {

  // src: ".",

  output: {
    // dir: "target",
    // name: '[basename]', // NameTemplate
  },

  assets: {

    name: {
      type: 'local',
      file: 'images/**/*.{png,jpg}',
      // manifest: false,       // Bool | Path => Maybe ManifestName
      // outputPath: undefined, // String
      // outputName: undefined, // NameTemplate
    }

    name: {
      type: 'external',
      path: 'whatever.js',
    },
  },
}
