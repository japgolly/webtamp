"use strict";

const
  HtmlMinifier = require('html-minifier'),
  Manifest = require('../manifest').Manifest,
  Modify = require('./modify'),
  PostHtml = require('posthtml');

const isHtmlFile = i => /\.html$/.test(i.filename);

const replacementPlugin = ({ test = isHtmlFile, modTag = i => t => t } = {}) => {
  return Modify.stateful(state => i => {
    if (test(i)) {
      const transformations = [
        transformRequireTag(state, modTag(i)),
        transformWebtampUrls(state),
      ];
      const newContent = PostHtml(transformations)
        .process(i.content(), { sync: true })
        .html
      return { newContent };
    }
  });
}

const transformRequireTag = (state, modTag) => tree => {
  tree.match({ tag: 'require' }, node => {
    const attrs = node.attrs || {};
    const assetName = attrs.asset;
    const manifestName = attrs.manifest;

    const replace = fn => {
      const links = [];
      const add = tag => {
        const t = modTag(tag);
        if (t) links.push(t);
      };
      fn(add);
      node.tag = false;
      node.content = [links.join("\n")].concat(node.content);
    }

    // Validate attribute count
    if (attrs.length === 0)
      state.addError(`<require/> missing attributes.`);
    else if (attrs.length > 1)
      state.addError(`Multiple attributes specified in <require/>: ${attrs}`);

    // asset="..."
    else if (assetName)
      replace(addTag => {
        const seen = new Set();
        const addAsset = name => {
          if (state.urls[name] === undefined)
            state.addError(`Asset referenced in <require/> not found: ${name}`);
          else if (name && !seen.has(name)) {
            seen.add(name);

            // Add dependencies
            Object.keys(state.graph[name]).forEach(addAsset);

            // Add named
            for (const urlEntry of state.urls[name])
              if (!urlEntry.transitive) {
                withTagForUrlEntry(state, urlEntry, addTag);
              }
          }
        };

        addAsset(assetName);
      })

    // manifest="..."
    else if (manifestName)
      replace(addTag =>
        withManifestEntry(state, manifestName, manifestEntry => {
          const urlEntry = Manifest.manifestEntryToUrlEntry(manifestEntry);
          withTagForUrlEntry(state, urlEntry, addTag);
        })
      )

    // <require ??? />
    else
      state.addError("<require/> tag needs an 'asset' attribute.");

    return node;
  });
  return tree;
};

const tagForUrlEntry = o => {
  const attrArray = [];
  const add = (k, vv) => {
    const v = vv || o[k];
    if (typeof v === 'string')
      attrArray.push(`${k}="${v}"`);
  };
  const attrs = () => attrArray.join(' ');

  const { url, as } = o;
  const urlEscaped = url; // Entities.escape(url);
  if (as === 'script' || /\.js$/.test(url)) {
    add('src', urlEscaped);
    add('integrity');
    add('crossorigin');
    return `<script ${attrs()}></script>`;
  } else if (as === 'style' ||/\.css$/.test(url)) {
    add('href', urlEscaped);
    add('integrity');
    add('crossorigin');
    return `<link rel="stylesheet" ${attrs()}>`;
  }
}

const withTagForUrlEntry = (state, urlEntry, use) => {
  const tag = tagForUrlEntry(urlEntry);
  if (tag)
    return use(tag);
  else
    state.addError("Don't know what kind of HTML tag is needed to load: " + urlEntry.url);
};

const transformWebtampUrls = state => tree => {

  const replaceManifestUrl = string =>
    state.resolveWebtampUrl(string, true) || string

  tree.match({ attrs: true }, node => {

    for (const [attr, attrValue] of Object.entries(node.attrs))
      node.attrs[attr] = replaceManifestUrl(node.attrs[attr]);

    if (node.tag == 'style' && node.content)
      // node.content is an Array
      node.content = node.content.map(c =>
        c.replace(
          /(url *\( *)(.+?)( *\))/,
          (m, p1, p2, p3) => `${p1}${replaceManifestUrl(p2)}${p3}`));

    return node;
  });
  return tree;
};

const withManifestEntry = (state, name, use) => {
  const entry = state.manifest.entries[name];
  if (entry === undefined)
    state.addError(`Manifest entry not found: ${name}`);
  else
    return use(entry);
}

const minifyPlugin = ({ test = isHtmlFile, options = {} } = {}) =>
  Modify.content(/\.html$/, html =>
    HtmlMinifier.minify(html, options))

export const minify = minifyPlugin
export const replace = replacementPlugin
