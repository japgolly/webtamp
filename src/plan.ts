import {
  Algo,
  As,
  CDN,
  Falsy,
  InlineFile,
  LocalSrc,
  ObjectTo,
  Op,
  URL,
} from './types'
import { MakeOptions } from './outputName'
import * as FS from 'fs'
import * as Glob from "glob"
import * as OutputName from './outputName'
import * as Path from 'path'
import * as Utils from './utils'
import State from './state'

export type RawConfig = ObjectTo<any>

type ConfigParser<A> = (inArray: boolean) => (name: string, value: any) => A

type ConfigReduction<A> = {
  string  : ConfigParser<A>
  local   : ConfigParser<A>
  external: ConfigParser<A>
  cdn     : ConfigParser<A>
}

type OutputNameFn = (_: InlineFile) => string

type MkOutputNameFn = (template: string) => OutputNameFn

type ValidationFn = (fs: Array<string>, files: string, src: string) => (Array<string | Falsy> | string | Falsy)

type PlanCtx = {state: State, mkOutputNameFn: MkOutputNameFn}

// =====================================================================================================================

function readConfigValue<A>(state: State,
                            name: string,
                            config: RawConfig,
                            type: string,
                            key: string,
                            defaultValue?: A
                          ): A | undefined {
  const v = config[key]
  if (typeof v === type)
    return v
  else if (typeof v === 'undefined') {
    if (defaultValue !== undefined)
      return defaultValue
    else
      state.addError(`Invalid ${name}: ${key} is missing.`)
  } else
    state.addError(`Invalid ${name}: ${key} must be of type ${type} but is ${typeof v}.`)
}

function readConfigString(state: State,
                          name: string,
                          config: RawConfig,
                          key: string,
                          defaultValue?: string
                          ): string | undefined {
  return readConfigValue(state, name, config, 'string', key, defaultValue)
}

function readConfigOptionalString(state: State,
                                  name: string,
                                  config: RawConfig,
                                  key: string,
                                  ): string | undefined {
  return readConfigValue<string | null>(state, name, config, 'string', key, null) || undefined
}

function readConfigObject(state: State,
                          name: string,
                          config: RawConfig,
                          key: string,
                          defaultValue?: ObjectTo<any>
                          ): ObjectTo<any> | undefined {
  return readConfigValue(state, name, config, 'object', key, defaultValue)
}

export function foldAsset<A>(state: State, cases: ConfigReduction<A>): (name: string, value: any) => (A | undefined) {
  const go: ConfigParser<A | undefined> = (inArray) => (name, value) => {
    if (Array.isArray(value)) {
      const g = go(true)
      value.forEach(v => g(name, v))
    } else if (typeof value === 'string')
      cases.string(inArray)(name, value)
    else if (typeof value === 'object')
      switch (value.type) {
        case 'local':
          return cases.local(inArray)(name, value)
        case 'external':
          return cases.external(inArray)(name, value)
        case 'cdn':
          return cases.cdn(inArray)(name, value)
        default:
          state.addError(`${name} has invalid asset type: ${JSON.stringify(value.type)}`)
      }
    else
      state.addError(`${name} has an invalid value: ${JSON.stringify(value)}`)
  }
  return go(false)
}

/**
 * @param {Any} manifestSetting Whatever the user has specified as their manifest setting
 */
function addManifest(state           : State,
                      desc           : string,
                      manifestSetting: any,
                      nameWhenTrue   : () => (string | undefined),
                      fnArg          : () => any,
                      addFn          : (_: string) => void): void {
  if (manifestSetting) {
    const maybeAdd = (n: string | undefined) => { if (n) addFn(n) }
    if (manifestSetting === true)
      maybeAdd(nameWhenTrue())
    else if (typeof manifestSetting === 'string')
      addFn(manifestSetting)
    else if (typeof manifestSetting === 'function')
      maybeAdd(manifestSetting(fnArg()))
    else
      state.addError(`${desc} has an invalid manifest: ${JSON.stringify(manifestSetting)}`)
  }
}

/**
 * @param {Any} manifest Whatever the user has specified as their manifest setting
 */
function arityAwareManifestName(state   : State,
                                subname : string,
                                inArray : boolean,
                                name    : string,
                                manifest: any,
                                fnArg   : () => any,
                                use     : (_: string) => void): void {
  const desc = inArray ? `${name}:${subname}` : name
  const whenTrue = () => {
    if (inArray)
      state.addError(`${desc} requires an explicit manifest name because it's in an array.`)
    else
      return name
  }
  addManifest(state, desc, manifest, whenTrue, fnArg, use)
}

const planLocal: (_: { state: State, mkOutputNameFn: MkOutputNameFn }, outputNameFn0: OutputNameFn) => (inArray: boolean) => (name: string, value: {
  src: string
  files: string,
  outputName?: string,
  outputPath?: string,
  manifest: boolean | ((path: string) => (string | null)),
  validate?: string | boolean | ValidationFn,
  transitive?: boolean
}) => void =
  ({ state, mkOutputNameFn }, outputNameFn0) => inArray => (name, value) => {
    const { files, outputName, outputPath, manifest, validate, transitive } = value
    state.checkThenRunIfNoErrors(() => {
      if (!files)
        state.addError(`${name} missing key: files`)
      if (manifest === true && inArray)
        state.addError(`${name} has {manifest: true} but requires an explicit name or function.`)
    }, () => {
      const src = value.src ? Path.resolve(state.src, value.src) : state.src
      const fs = Glob.sync(files, { cwd: src, nodir: true }).sort()

      // Validate
      let validateFn: ValidationFn | null =
        typeof validate === 'function' ? validate :
        typeof validate === 'string' ? _ => validate :
        typeof validate === 'boolean' ? _ => [] :
        typeof validate === 'undefined' ? defaultLocalFileValidation :
        null // lol do more lazy!

      const validationErrors: Array<string> = []
      if (validateFn)
        Utils.asArray(validateFn(fs, files, src)).forEach(e => {if (e) validationErrors.push(e)})

      if (validationErrors.length > 0) {
        const descSrc = value.src ? value.src + '/' : ''
        const desc = `${name}:${descSrc}${files}`
        validationErrors.forEach(e => state.addError(`${desc} - ${e}`))

      } else {
        const outputNameFn: OutputNameFn =
          transitive ? mkOutputNameFn("[path]/[basename]") :
          outputName ? mkOutputNameFn(outputName) :
          outputNameFn0
        state.registerNow(name)

        // Add each local file
        for (const f of fs) {
          const srcFilename = Path.resolve(src, f)
          const contents = Utils.memoise(() => FS.readFileSync(srcFilename))
          let newName = outputNameFn({ name: f, contents })
          if (outputPath)
            newName = `${outputPath}/${newName}`
          newName = newName.replace(/^\.\//g, '')

          // Copy file
          state.addOpCopy(new LocalSrc(src, f), newName, transitive)

          const url = '/' + newName
          const urlEntry: URL = { url }
          if (transitive !== undefined)
            urlEntry.transitive = transitive
          state.addUrl(name, urlEntry)

          // Add to manifest
          const whenTrue = () => {
            if (fs.length > 1)
              state.addWarn(`${name} has {manifest: true} but '${files}' matches more than 1 file.`)
            else
              return name
          }
          addManifest(state, name, manifest, whenTrue, () => f, n => state.manifest.addPathLocal(n, url))
        }
      }
    })
  }

const defaultLocalFileValidation: ValidationFn = (fs, glob, src) =>
  fs.length === 0 && `0 files found.`
// fs.length === 0 && `0 files found. (Add {validate: false} to disable this check.)`

const planCdn: (ctx: PlanCtx) => ConfigParser<void> = ctx => inArray => (name, config) => {
  const { state } = ctx
  const cfgName = `config in ${name}`
  const defaultAlgos: Algo = 'sha256'
  state.checkThenRunIfNoErrors(() => {
    const url      = readConfigString(state, cfgName, config, "url")
    const _as      = readConfigOptionalString(state, cfgName, config, "as")
    let as: As | undefined | null = null
    switch (_as) {
      case 'script':
      case 'style':
      case undefined:
        as = _as
        break;
      default:
        state.addError(`Invalid "at" value: ${_as}. Must be either 'script' or 'style'.`)
    }
    return (url && (as !== null)) && { url, as } || false
  }, ({ url, as }) => {
    const { integrity, manifest } = config
    const desc = name
    let i: string | false | undefined = false // Option[ValidIntegrityAttribute]

    if (!integrity)
      i = undefined

    else if (typeof integrity === 'string')
      i = integrity

    // integrity: { files: 'image2.svg', algo: 'sha384' }
    else if (typeof integrity === 'object') {
      const algos = Utils.asArray(integrity.algo || defaultAlgos)
      const { files } = integrity
      if (files) {
        const fs = Glob.sync(files, { cwd: state.src, nodir: true }).sort()
        if (fs.length == 0)
          state.addError(`${desc} integrity file(s) not found: ${files}`)
        else
          state.checkThenRunIfNoErrors(() => {
            const hashes = []
            for (const algo of algos) {
              const hasher = Utils.hashData(algo, 'base64')
              for (const f of fs) {
                const h = hasher(FS.readFileSync(Path.resolve(state.src, f)))
                hashes.push(`${algo}-${h}`)
              }
            }
            return hashes
          }, hashes => {
            i = hashes.join(' ')
          })
      } else
        state.addError(`${desc} integrity missing key: files`)

    } else
      state.addError(`${desc} has an invalid integrity value: ${JSON.stringify(integrity)}`)
    if (i || i === undefined) {
      const cdn: CDN = Utils.removeUndefinedValues({ url, as, integrity: i })
      const fnArg = () => cdn
      state.registerNow(name)
      const urlObj: URL = Utils.removeUndefinedValues({ crossorigin: 'anonymous', url, as, integrity: i })
      state.addUrl(name, urlObj)
      arityAwareManifestName(state, url, inArray, name, manifest, fnArg, n => {
        state.manifest.addPathCdn(n, cdn)
      })
    }
  })
}

const planExternal: (ctx: PlanCtx) => ConfigParser<void> = ctx => inArray => (name, config) => {
  const { state } = ctx
  const cfgName = `config in ${name}`
  state.checkThenRunIfNoErrors(() => {
    const path     = readConfigString(state, cfgName, config, "path")
    const manifest = config.manifest
    return path && { path, manifest } || false
  }, ({ path, manifest }) => {
    const url = path.replace(/^\/?/, '/')
    state.registerNow(name)
    state.addUrl(name, { url })
    arityAwareManifestName(state, path, inArray, name, manifest, () => path, n => {
      state.manifest.addPathLocal(n, url)
    })
  })
}

const planRef: (ctx: PlanCtx) => ConfigParser<void> = ctx => inArray => (name, config) => {
  const { state } = ctx
  if (typeof config === 'string') {
    state.registerNow(name)
    state.addDependency(name, config)
  } else
    state.addError(`Invalid value for ${name} config. Expected a string, got: ${JSON.stringify(config)}`)
}

export const parse = (config: RawConfig): State => {
  let state = new State("", "")
  const _src   = readConfigString(state, "config", config, "src", ".")
  const output = readConfigObject(state, "config", config, "output", {})
  if (!_src || !output)
    return state

  const _dir = readConfigString(state, "config.output", output, "dir")
  if (!_dir)
    return state

  const src = Path.resolve(_src)
  const target = Path.resolve(_dir)
  state = new State(src, target)

  if (!FS.existsSync(src))
    state.addError(`Src dir doesn't exist: ${src}`)

  if (state.ok()) {
    const
      outputNameFnDefaults: MakeOptions = {},
      mkOutputNameFn: MkOutputNameFn = f => OutputName.make(f, outputNameFnDefaults),
      outputNameFn: OutputNameFn = mkOutputNameFn(config.output.name || '[basename]'),
      ctx: PlanCtx = { state, mkOutputNameFn }

    const cases: ConfigReduction<void> = {
      string  : planRef(ctx),
      local   : planLocal(ctx, outputNameFn),
      external: planExternal(ctx),
      cdn     : planCdn(ctx),
    }

    // Parse config.optional
    {
      const o = config.optional
      if (o) {
        const defer: (f: ConfigParser<void>) => ConfigParser<void> = f => inArray => (n, v) => {
          state.registerForLater(n, () => f(inArray)(n, v))
        }
        const casesDeferred = Utils.mapObjectValues(cases, defer) as ConfigReduction<void>
        const add = foldAsset(state, casesDeferred)
        for (const [name, value] of Object.entries(o))
          add(name, value)
      }
    }

    // Parse config.assets
    {
      const add = foldAsset(state, cases)
      for (const [name, value] of Object.entries(config.assets)) {
        // console.log(`Parsing asset "${name}" = ${JSON.stringify(value)}`)
        add(name, value)
      }
    }

    // Graph dependencies
    state.resolvePending()
    state.graphDependencies()
  }

  return state
}

export const runPlugins = (cfg: RawConfig) => Utils.tap((state: State) => {
  if (state.ok())
    for (const p of Utils.asArray(cfg.plugins))
      if (state.ok() && p)
        p(state)
})

export const generateManifest = (cfg: RawConfig) => Utils.tap((state: State) => {
  if (state.ok()) {
    const gen = (filename: string) => {
      const content = state.manifest.writeOpJson()
      state.addOpWrite(filename, content)
    }
    const m = cfg.output.manifest
    if (m === undefined || m === true)
      gen('manifest.json')
    else if (typeof m === 'string')
      gen(m)
    else if (m !== false)
      state.addError(`Invalid value for config.output.manifest: ${JSON.stringify(m)}`)
  }
})

const ensureNoDuplicateTargets = Utils.tap((state: State) => {
  const targetIndex: ObjectTo<Array<Op>> = {}
  const getTarget = Utils.opReduce({
    copy: op => op.to.abs,
    write: op => op.to.abs,
  })
  state.ops.forEach(op => {
    const t = getTarget(op)
    if (!targetIndex[t]) targetIndex[t] = []
    targetIndex[t].push(op)
  })
  Object.entries(targetIndex).forEach(([t, ops]) => {
    if (ops.length !== 1)
      state.addError(`Multiple assets write to the same target: ${Path.relative(state.target, t)}`)
  })
})

export const run = (cfg: RawConfig) =>
  Utils.compose([
    ensureNoDuplicateTargets,
    generateManifest(cfg),
    runPlugins(cfg)
  ])(parse(cfg))
