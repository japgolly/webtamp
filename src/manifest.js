"use strict";

const Utils = require('./utils');

class Manifest {
  constructor() {
    this.paths = {};
  }

  addPath(k, v) {
    if (this.paths[k] && this.paths[k] !== v) {
      const o = {}
      o[k] = this.paths[k];
      this.addWarn("Overwriting manifest entry: " + JSON.stringify(o))
    }
    this.paths[k] = v;
  }

  addPathLocal(name, local) {
    this.addPath(name, { local })
  }

  addPathCdn(name, cdn) {
    this.addPath(name, { cdn })
  }

  mapPathValues(f) {
    this.paths = Utils.mapObjectValues(this.paths, f);
  }

  writeOpJson() {
    return JSON.stringify(this.paths, null, '  ');
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
