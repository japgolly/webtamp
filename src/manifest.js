"use strict";

const Utils = require('./utils');

class Manifest {
  constructor() {
    this.entries = {};
  }

  addEntry(k, v) {
    if (this.entries[k] && this.entries[k] !== v) {
      const o = {}
      o[k] = this.entries[k];
      this.addWarn("Overwriting manifest entry: " + JSON.stringify(o))
    }
    this.entries[k] = v;
  }

  addPathLocal(name, local) {
    this.addEntry(name, { local })
  }

  addPathCdn(name, cdn) {
    this.addEntry(name, { cdn })
  }

  addUrl(name, url) {
    this.addEntry(name, { url })
  }

  addList(name, list) {
    this.addEntry(name, { list })
  }

  delete(name) {
    delete this.entries[name];
  }

  mapValues(f) {
    this.entries = Utils.mapObjectValues(this.entries, f);
  }

  writeOpJson() {
    return JSON.stringify(this.entries, null, '  ');
  }
}

Manifest.url = (entry, allowCdn) => {
  let r = entry.local || entry.url;
  if (!r && allowCdn && entry.cdn) r = entry.cdn.url;
  return r;
}

Manifest.manifestEntryToUrlEntry = m => {
  let u = {};
  if (m.cdn) {
    Object.assign(u, m.cdn);
    u.crossorigin = 'anonymous'; // aaaaaaaaaah the temp hacks
  } else {
    u.url = Manifest.url(m, false);
  }
  return u;
}

module.exports = Manifest;
