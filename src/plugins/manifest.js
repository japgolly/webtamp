const
  Path = require('path'),
  Manifest = require('../manifest');
  State = require('../state');

const term = n =>
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n) ? n : "`" + n + "`";

const stringLiteral = s =>
  /["\n\r\t\\]/.test(s) ? `"""${s}"""` : `"${s}"`;

const scala = ({ object, filename, outputPath, nameMod = n => n }) => state => {

  const fqcn = object.match(/^(.+)\.([^.]+)$/);
  if (!fqcn) {
    state.addError(`Invalid object FQCN: ${objectName}`);
  } else {

    const manifest = state.manifest;
    const [, pkg, obj] = fqcn;

    const defs = [];
    for (const k of Object.keys(manifest.entries).sort()) {
      const v = manifest.entries[k];
      // console.log(`${k} = ${require('../utils').inspect(v)}`)

      const url = Manifest.url(v, false);
      if (url) {
        const name = nameMod(k);
        defs.push(`def ${term(name)} = ${stringLiteral(url)}`)
      }

      // final case class Resource(url: String, integrity: Option[String])
    }

    const content = [
      `package ${pkg}`,
      "",
      "/** Generated by webtamp. */",
      `object ${obj} {`,
      "",
      defs.map(l => `  ${l}`).join("\n\n"),
      "}"
    ].join("\n");

    // console.log("-------------------------------------------------------------------------")
    // console.log(content);
    // console.log("-------------------------------------------------------------------------")

    let outfile = filename || `${obj}.scala`;
    if (outputPath)
      outfile = Path.join(outputPath, outfile);

    state.addOpWrite(outfile, content);
  }
};

module.exports = {
  generate: {scala}
};
