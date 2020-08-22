import * as Action from './action'
import * as Plan from './plan'
import * as plugins from './plugins'
import State from './state'

function run(cfg: Plan.RawConfig, options: Action.Options = {}): State {
  const state = Plan.run(cfg)
  Action.run(state.results(), options)
  return state
}

export {
  plugins,
  run,
}