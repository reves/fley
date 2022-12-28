import { current, update, queue } from './renderer'
import { getMethods } from '../utils'

// Current hook index of the current Fiber.
let cursor = 0
export const resetCursor = _ => cursor = 0

// Checks if arrays are the same.
const same = (prev, next) => prev
    && prev.length === next.length
    && prev.every((p, i) => p === next[i])

const getStates = () => [current.states, cursor++]

/**
 * State
 */
export const useState = initial => useReducer(false, initial)

export function useReducer(reducer, initialState) {
    const [states, i] = getStates()
    const fiber = current
    const state = i in states ? states[i] : (states[i] = initialState)
    return [ state, reducer
            ? (action) => {
                states[i] = reducer(state, action)
                if (states[i] !== state) update(fiber)
            }
            : (data) => {
                states[i] = (typeof data === 'function') ? data(state) : data
                if (states[i] !== state) update(fiber)
            }
    ]
}

export function useRef(initial = null) {
    const [states, i] = getStates()
    if (i in states) return states[i]
    const ref = function(value) {
        if (arguments.length) ref.current = value
        return ref.current
    }
    ref.current = initial
    return states[i] = ref
}

export function useMemo(fn, deps) {
    const [states, i] = getStates()
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
    const effect = current.effects[cursor++] ??= new Effect(sync)
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
            effect.fn = null
        }
        return
    }
    effect.fn = () => {
        cleanup && cleanup()
        effect.cleanup = fn()
        effect.deps = deps
        effect.fn = null
    }
}

/**
 * Store
 */
export function createStore(StoreClass, ...args) {
    if (!StoreClass.__ley) {
        // Wrap non-static methods (including extended ones)
        StoreClass.__ley = true
        let depth = 0
        for (const method of getMethods(StoreClass)) {
            const action = StoreClass.prototype[method]
            StoreClass.prototype[method] = function() {
                depth++
                const result = action.apply(this, arguments)
                depth--
                if (depth === 0 && result !== null) this.action()
                return depth === 0 ? this : result
            }
        }
    }
    // Set up the store and watchers list
    const store = new StoreClass(...args)
    store.action = (fn) => {
        fn && fn()
        new Set(store.action.__watchers).forEach(([fiber, condition]) => condition
            ? condition(store) && update(fiber)
            : update(fiber)
        )
    }
    store.action.__watchers = new Set
    return store
}

export function useStore(store, condition) {
    const watchers = store.action.__watchers
    const entry = [current, condition]
    useLayoutEffect(() => {
        watchers.add(entry)
        return () => watchers.delete(entry)
    })
}