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

const replacementPlugin = ({ test = isHtmlFile } = {}) => {
  return Modify.stateful(state => {
    const transformations = [
      transformRequireTag(state),
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

const transformRequireTag = state => tree => {
  tree.match({ tag: 'require' }, node => {
    const assetName = node.attrs && node.attrs.asset;
    if (!assetName)
      state.addError("<require/> tag needs an 'asset' attribute.");
    else {
      const links = [];
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
              const tag = tagToLoadUrl(urlEntry);
              if (tag)
                links.push(tag);
              else
                state.addError("Don't know what kind of HTML tag is needed to load: " + urlEntry.url);
            }
        }
      };

      addAsset(assetName);
      // return { tag: false, content: content };
      node.tag = false;
      node.content = [links.join("\n")].concat(node.content);
      return node;
    }
  });
  return tree;
};

const tagToLoadUrl = o => {
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
          const entry = state.manifest[name];
          if (entry === undefined)
            state.addError(`Manifest entry not found: ${name}`);
          else {
            const url = State.manifestUrl(entry, true);
            if (url)
              node.attrs[attr] = url;
            else
              state.addError(`URL for manifest entry unknown: ${attrValue}`);
          }
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

const minifyPlugin = ({ test = isHtmlFile, options = {} } = {}) =>
  Modify.content(/\.html$/, html =>
    HtmlMinifier.minify(html, options))

module.exports = {
  minify: minifyPlugin,
  replace: replacementPlugin,
};
