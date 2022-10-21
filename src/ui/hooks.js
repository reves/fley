import { current, update, queue } from './renderer'
import { getMethods } from '../utils'

export default function Hooks() {
    this.states = []
    this.effects = []
    this.stores = new Set
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
    const fiber = current
    const hooks = current.hooks
    const states = hooks.states
    const state = i in states ? states[i] : (states[i] = initialState)
    if (reducer) return [state, (action) => {
        states[i] = reducer(state, action)
        update(fiber)
    }]
    return [state, (data) => {
        states[i] = (typeof data === 'function') ? data(state) : data
        update(fiber)
    }]
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
export const storesWatchers = new Map

export function createStore(ClassName) {
    const watchers = new Set

    // Wrap non-static methods (including extended ones)
    let depth = 0
    getMethods(ClassName).forEach(m => {
        const action = ClassName.prototype[m]
        ClassName.prototype[m] = function() {
            depth++
            const result = action.apply(this, arguments)
            depth--
            if (depth === 0 && result !== null) watchers.forEach(fiber => update(fiber))
            return depth === 0 ? this : result
        }
    })

    // Define the reserved "action" method
    ClassName.prototype.action = (fn) => {
        fn && fn()
        watchers.forEach(fiber => update(fiber))
    }

    // Set up the store
    const store = new ClassName
    storesWatchers.set(store, watchers)
    return store
}

export function useStore(store) {
    const fiber = current
    const watchers = storesWatchers.get(store)
    useLayoutEffect(() => {
        if (fiber.alt) {
            watchers.delete(fiber.alt)
            watchers.add(fiber)
        } else {
            fiber.hooks.stores.add(store)
            watchers.add(fiber)
        }
        return () => watchers.delete(fiber)
    })
}