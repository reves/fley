import { current, update } from './renderer'
import { same, getMethods } from '../utils'

export default function Hooks(fiber) {
    this.fiber = fiber
    this.effects = []
    this.states = []
    this.stores = []
    this.refs = []
    this.memos = []
}

let cursor = 0
export const resetCursor = _ => cursor = 0

/**
 * Effect
 */
export const useEffect = (fn, deps) => _useEffect(fn, deps, effectType.EFFECT)
export const useLayoutEffect = (fn, deps) => _useEffect(fn, deps, effectType.LAYOUT)

function _useEffect(fn, deps, type) {
    const effect = (current.hooks.effects[cursor++] ??= new Effect(type))
    effect.fn = fn
    effect.deps.next = deps
}

export const effectType = {
    EFFECT: 1,
    LAYOUT: 2,
}

function Effect(type) {
    this.type = type
    this.fn = null
    this.cleanup = null
    this.deps = { prev: null, next: null }
}

/**
 * Ref
 */
export function useRef(initial = null) {
    const i = cursor++
    const refs = current.hooks.refs
    if (!refs[i]) {
        const ref = _ => ref.current
        ref.current = initial
        refs[i] = ref
    }
    return refs[i]
}

/**
 * Memoization
 */
export function useMemo(fn, deps) {
    const i = cursor++
    const memos = current.hooks.memos
    const memo = memos[i] ??= []
    if (same(memo[1], deps)) return memo[0]
    memo[1] = deps
    return memo[0] = fn()
}

export const useCallback = (fn, deps) => useMemo(() => fn, deps)

/**
 * State
 */
export function useState(initial) {
    const i = cursor++
    const hooks = current.hooks
    const states = hooks.states
    return states[i] ??= [initial, data => {
        if (!hooks.fiber) return // did unmount
        states[i][0] = (typeof data === 'function')
            ? data(states[i][0])
            : data
        update(hooks.fiber)
    }]
}

export function useReducer(reducer, initialState) {
    const i = cursor++
    const hooks = current.hooks
    const states = hooks.states
    return states[i] ??= [initialState, action => {
        if (!hooks.fiber) return // did unmount
        states[i][0] = reducer(states[i][0], action)
        update(hooks.fiber)
    }]
}

/**
 * Store
 */
export function createStore(ClassName) {
    const watchers = []

    // Wrap methods (including extended ones)
    let depth = 0
    getMethods(ClassName).forEach(m => {
        const action = ClassName.prototype[m]
        ClassName.prototype[m] = function() {
            depth++
            const result = action.apply(this, arguments)
            depth--
            if (depth === 0 && result !== null) watchers.forEach(update)
            return depth === 0 ? this : result
        }
    })

    // Define the reserved "action" method
    ClassName.prototype.action = (fn) => {
        fn && fn()
        watchers.forEach(update)
    }

    // Set up the store
    const store = new ClassName
    storesWatchers.set(store, watchers)
    return store
}

export function useStore(store) {
    if (current.alt) return
    let fiber = current
    while (fiber) {
        if (fiber.isComponent && ~fiber.hooks.stores.indexOf(store)) return
        fiber = fiber.parent
    }
    current.hooks.stores.push(store)
    storesWatchers.get(store).push(current)
}

export const storesWatchers = new WeakMap

export function loseStore(store, fiber) {
    const watchers = storesWatchers.get(store)
    const i = watchers.indexOf(fiber)
    if (~i) watchers.splice(i, 1)
}
