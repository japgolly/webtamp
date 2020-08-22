import { CDN, ObjectTo, URL } from './types'
import * as Utils from './utils'
import State from './state'

type Local = string

export type Entry = {
  local?: Local
  cdn  ?: CDN
  url  ?: URL
  list ?: Array<string>
}

export class Manifest {
  private state: State
  private entries: ObjectTo<Entry>

  constructor(s: State) {
    this.entries = {}
    this.state = s
  }

  getEntries() {
    return this.entries
  }

  addEntry(k: string, v: Entry): void {
    if (this.entries[k] && this.entries[k] !== v) {
      const o = {k: this.entries[k]}
      this.state.addWarn("Overwriting manifest entry: " + JSON.stringify(o))
    }
    this.entries[k] = v
  }

  addPathLocal(name: string, local: Local): void {
    this.addEntry(name, { local })
  }

  addPathCdn(name: string, cdn: CDN): void {
    this.addEntry(name, { cdn })
  }

  addUrl(name: string, url: string | URL): void {
    const e: Entry =
      (typeof url === 'string')
      ? { url: {url }}
      : { url }
    this.addEntry(name, e)
  }

  addList(name: string, urls: Array<string>): void {
    this.addEntry(name, { list: urls })
  }

  delete(name: string): void {
    delete this.entries[name]
  }

  mapValues(f: (_: Entry) => Entry): void {
    this.entries = Utils.mapObjectValues(this.entries, f)
  }

  writeOpJson() {
    return JSON.stringify(this.entries, null, '  ')
  }

  static url = (entry: Entry, allowCdn: boolean): string | null => {
    let r = entry.local || entry.url?.url || null
    if (!r && allowCdn && entry.cdn) r = entry.cdn.url
    return r
  }

  static manifestEntryToUrlEntry = (m: Entry): URL | null => {
    if (m.cdn) {
      const cdn = m.cdn
      const u: URL = {
        url: cdn.url,
        crossorigin: 'anonymous' // aaaaaaaaaah the temp hacks
      }
      if (cdn.integrity) u.integrity = cdn.integrity
      if (cdn.transitive) u.transitive = cdn.transitive
      if (cdn.as) u.as = cdn.as
      return u
    } else {
      const url = Manifest.url(m, false)
      return url ? { url } : null
    }
  }
}
