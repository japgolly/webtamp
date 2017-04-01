export default {

  // [Optional] Directory from which all assets paths are relative.
  // Default = "."
  src: ".",

  output: {

    // [Mandatory] Directory in which all webtamp output is written.
    dir: "dist",

    // [Optional] The filename template for all output.
    //
    // Replaces tokens:
    // * [name]     - The filename without path and without file extension.
    // * [ext]      - The file extension.
    // * [basename] - The file basename, equivalent to [name].[ext]
    // * [path]     - The path relative to the src directory.
    // * [hash]     - A hash of the file content (using the default hash algorithm).
    //                You can also specify a specific algorithm like [sha256], [md5], etc.
    // * [hash:n]   - As above but truncated to n chars.
    //
    // Default = "[basename]"
    name: '[basename]',

    // [Optional]
    // True   - Write the manifest to manifest.json.
    // False  - Don't create a manifest file.
    // String - Write the manifest to this filename.
    //
    // Default = true
    manifest: true,
  },

  // Mandatory assets
  //
  // An object where the:
  // * keys are the names (ids) of the asset(s). Used to require other assets.
  // * values are the asset value(s) which can be:
  //   * String                - Requires another asset as a dependency.
  //   * Object[type=local]    - Zero or more local files. These will be copied to config.output.dir when required.
  //   * Object[type=cdn]      - A CDN-hosted asset.
  //   * Object[type=external] - A path that will be served by your server, that you want to trust to exist.
  //   * Array                 - A collection of the above.
  assets: {

    // Example of type=local
    localExample: {
      type: 'local',

      // [Mandatory] Local files to glob.
      files: 'images/**/*.{png,jpg}',

      // [Optional]
      // Bool           - Whether to include these files in the manifest.
      // Path => String - Function that takes an asset path+filename and if it is desirable to
      //                - include it in the manifest, returns a manifest name.
      //
      // Default = false
      manifest: false,

      // [Optional] Directory from which the files glob is relative.
      // If unspecified, the root config.src value is used.
      //
      // Default = undefined = config.src
      src: undefined,

      // [Optional] Specify a sub-directory in the output directory in which to copy assets.
      //
      // Default = undefined = "/"
      outputPath: undefined,

      // [Optional] Override the filename template from config.output.name
      //
      // Default = undefined = config.output.name
      outputName: undefined,

      // [Optional] Whether these files are transitive dependencies of something else.
      // These are typically fonts and images used by a 3rd-party non-modular library.
      //
      // Transitive dependencies:
      // * have outputName of "[path]/[basename]"
      // * are not modified or renamed by plugins
      // * are not loaded directly (i.e. the HTML.replace plugin will not insert tags to load these assets).
      //
      // Default = false
      transitive: false,

      // [Optional] Validate the glob results.
      //
      // The main format is a function that takes an array of matched files and returns
      // an erorr msg (or array of error msgs) if anything is wrong.
      // (files :: Array, glob :: String, srcDir :: String) => String | Array String | something falsy
      //
      // Other acceptable values are:
      // Bool           - No validation/errors. Any results pass.
      // String         - Always fail with given error.
      //
      // Default = fail when 0 files found
      validate: false,
    }

    // Example of type=cdn
    cdnExample: {
      type: 'cdn',

      // [Mandatory] The asset URL
      url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js',

      // [Optional] Specify the link integrity attribute. (SRI)
      // Default = undefined
      //
      // Example: A trusted value to use.
      integrity: 'sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=',
      // Example: Calculate the integrity using trusted, local files.
      integrity: {
        files: 'node_modules/jquery/dist/jquery*.js', // A glob pattern (multiple files are legal)
        algo: 'sha256', // String | Array String - hash algorithms to use (multiple files are legal)
      },

      // [Optional]
      // Bool             - Whether to include this in the manifest.
      // String => String - Function that takes the URL if it is desirable to include it in the manifest,
      //                    returns a manifest name.
      //
      // Default = false
      manifest: false,
    },

    // Example of type=external
    externalExample: {
      type: 'external',

      // [Mandatory] The asset path relative to your server root
      path: '/stats.json?time=1d',

      // [Optional]
      // Bool             - Whether to include this in the manifest.
      // String => String - Function that takes the path above if it is desirable to include it in the manifest,
      //                    returns a manifest name.
      //
      // Default = false
      manifest: false,
    },

    // You can create new assets that simply depend on another. Effectively an alias.
    aliasExample: "cdnExample",

    // You can merge any of the above into an array to make a bundle.
    bundleExample: [
      {type: 'local', files: 'robot.txt'},
      'aliasExample',
      'localExample',
    ],
  },

  // Optional assets
  optional: {
    // same as 'assets' above
  },

  plugins: [
    // State => Unit
  ]
}
