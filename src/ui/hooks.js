import { current, update, queue } from './renderer'
import { getMethods } from '../utils'

export default function Hooks(fiber) {
    this.fiber = fiber
    this.states = []
    this.effects = []
}

let cursor = 0
export const resetCursor = _ => cursor = 0
const same = (prev, next) => prev
    && prev.length === next.length
    && prev.every((p, i) => Object.is(p, next[i]))

/**
 * State
 */
export const useState = initial => useReducer(false, initial)

export function useReducer(reducer, initialState) {
    const i = cursor++
    const hooks = current.hooks
    const states = hooks.states
    if (i in states) return states[i]
    const state = [
        initialState,
        reducer
            ? (action) => {
                if (!hooks.fiber) return
                state[0] = reducer(state[0], action)
                update(hooks.fiber)
            }
            : (data) => {
                if (!hooks.fiber) return
                state[0] = (typeof data === 'function') ? data(state[0]) : data
                update(hooks.fiber)
            }
    ]
    return  states[i] = state
}

export function useRef(initial = null) {
    const i = cursor++
    const states = current.hooks.states
    if (i in states) return states[i]
    const ref = function(value) {
        if (arguments.length) ref.current = value
        return ref.current
    }
    ref.current = initial
    return states[i] = ref
}

export function useMemo(fn, deps) {
    const i = cursor++
    const states = current.hooks.states
    const memo = states[i] ??= []
    if (same(memo[1], deps)) return memo[0]
    memo[1] = deps
    return memo[0] = fn()
}

export const useCallback = (fn, deps) => useMemo(() => fn, deps)

/**
 * Effect
 */
function Effect(sync = false) {
    this.sync = sync
    this.fn = null
    this.cleanup = null
    this.deps = null
}

export const useEffect = (fn, deps) => _useEffect(fn, deps)
export const useLayoutEffect = (fn, deps) => _useEffect(fn, deps, true)

function _useEffect(fn, deps, sync) {
    const effect = current.hooks.effects[cursor++] ??= new Effect(sync)
    if (same(effect.deps, deps)) {
        effect.fn = null
        return
    }
    const cleanup = effect.cleanup
    if (sync) {
        cleanup && queue.sync.push(cleanup)
        effect.fn = () => {
            effect.cleanup = fn()
            effect.deps = deps
        }
        return
    }
    effect.fn = () => {
        cleanup && cleanup()
        effect.cleanup = fn()
        effect.deps = deps
    }
}

/**
 * Store
 */
const storesWatchers = new WeakMap

export function createStore(StoreClass, ...args) {
    // Wrap non-static methods (including extended ones)
    if (!StoreClass.__ley) {
        let depth = 0
        getMethods(StoreClass).forEach((m) => {
            const action = StoreClass.prototype[m]
            StoreClass.prototype[m] = function() {
                depth++
                const result = action.apply(this, arguments)
                depth--
                if (depth === 0 && result !== null) this.action()
                return depth === 0 ? this : result
            }
        })
        StoreClass.__ley = true
    }
    // Set up the store and watchers list
    const watchers = new Set
    const store = new StoreClass(...args)
    store.action = (fn) => {
        fn && fn()
        new Set(watchers)
            .forEach(([fiber, condition]) => condition
                ? condition() && update(fiber)
                : update(fiber)
            )
    }
    storesWatchers.set(store, watchers)
    return store
}

export function useStore(store, condition) {
    const watchers = storesWatchers.get(store)
    const entry = [current, condition]
    useLayoutEffect(() => {
        watchers.add(entry)
        return () => watchers.delete(entry)
    })
}