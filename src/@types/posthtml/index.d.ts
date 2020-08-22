declare module 'posthtml' {

  type ObjectTo<V> = {[key: string]: V}

  interface RecObjectTo<A> {
    [key: string]: A | RecObjectTo<A>
  }

  export type Node = RecObjectTo<string>

  export type MatchCallback = (n: Node) => Node

  export interface MatchOptions {
    attrs?: boolean
    tag?: string
  }

  export interface PostHTMLTree {
    match: (expr: MatchOptions | Array<MatchOptions>, cb: MatchCallback) => void
  }

  export type Plugin = (t: PostHTMLTree) => PostHTMLTree

  export class PostHTML {
    constructor(plugins?: Array<Plugin>)

    process(tree, options): SyncResult
  }

  export interface SyncResult {
    html: string
    tree: PostHTMLTree
  }

  export function create(plugins?: Array<Plugin>): PostHTML

  export = create
}
