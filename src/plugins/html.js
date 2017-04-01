"use strict";

const
  Entities = require("entities"),
  FS = require('fs'),
  HtmlMinifier = require('html-minifier'),
  Mime = require('mime-types'),
  Modify = require('./modify'),
  Path = require('path'),
  PostHtml = require('posthtml'),
  Utils = require('../utils');

const isHtmlFile = i => /\.html$/.test(i.filename);

const replacementPlugin = ({ test = isHtmlFile } = {}) => {
  return Modify.stateful(state => {
    const transform = transformer(state);
    return i => {
      if (test(i)) {
        const newContent = PostHtml(transform).process(i.content(), { sync: true }).html
        return { newContent };
      }
    }
  });
}

const transformer = state => tree => {
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
          for (const urlEntry of state.urls[name]) {
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

const minifyPlugin = ({ test = isHtmlFile, options = {} } = {}) =>
  Modify.content(/\.html$/, html =>
    HtmlMinifier.minify(html, options))

module.exports = {
  minify: minifyPlugin,
  replace: replacementPlugin,
};
