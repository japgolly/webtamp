"use strict";

const
  Entities = require("entities"),
  FS = require('fs'),
  HtmlMinifier = require('html-minifier'),
  Mime = require('mime-types'),
  Modify = require('./modify'),
  Path = require('path'),
  PostHtml = require('posthtml'),
  State = require('../state'),
  Utils = require('../utils');

const isHtmlFile = i => /\.html$/.test(i.filename);

const replacementPlugin = ({ test = isHtmlFile, modTag = t => t } = {}) => {
  return Modify.stateful(state => {
    const transformations = [
      transformRequireTag(state,  modTag),
      transformWebtampUrls(state),
    ];
    return i => {
      if (test(i)) {
        const newContent = PostHtml(transformations)
          .process(i.content(), { sync: true })
          .html
        return { newContent };
      }
    }
  });
}

const transformRequireTag = (state,  modTag) => tree => {
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
          const urlEntry = State.manifestEntryToUrlEntry(manifestEntry);
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

  const { url } = o;
  const urlEscaped = Entities.escape(url);
  if (/\.js$/.test(url)) {
    add('src', urlEscaped);
    add('integrity');
    add('crossorigin');
    return `<script ${attrs()}></script>`;
  } else if (/\.css$/.test(url)) {
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

const webtampUrl = /^webtamp:\/\/(.*)$/;
const webtampManifestPath = /manifest\/(.*)$/;
const transformWebtampUrls = state => tree => {
  tree.match({ attrs: true }, node => {

    for (const [attr, attrValue] of Object.entries(node.attrs)) {
      let m = attrValue.match(webtampUrl);
      if (m) {
        const path = m[1];

        // Manifest URLs
        if (m = path.match(webtampManifestPath)) {
          const name = m[1];
          withManifestUrl(state, name, url => node.attrs[attr] = url);
        }

        // Invalid URL type
        else
          state.addError(`Invalid webtamp url: ${attrValue}`);
      }
    }

    return node;
  });
  return tree;
};

const withManifestEntry = (state, name, use) => {
  const entry = state.manifest[name];
  if (entry === undefined)
    state.addError(`Manifest entry not found: ${name}`);
  else
    return use(entry);
}

const withManifestUrl = (state, name, use) =>
  withManifestEntry(state, name, entry => {
    const url = State.manifestUrl(entry, true);
    if (url)
      return use(url);
    else
      state.addError(`Unable to discern URL for manifest entry: {${name}: ${entry}}`);
  });

const minifyPlugin = ({ test = isHtmlFile, options = {} } = {}) =>
  Modify.content(/\.html$/, html =>
    HtmlMinifier.minify(html, options))

module.exports = {
  minify: minifyPlugin,
  replace: replacementPlugin,
};
