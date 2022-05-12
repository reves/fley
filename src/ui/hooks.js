import { current, update } from './renderer'
import { getMethodsNames } from '../utils'

export const resetCursor = _ => cursor = 0
let cursor = 0

/**
 * Effect
 */
export const effectType = {
    EFFECT: 1,
    LAYOUT: 2,
}

export const useEffect = (cb, deps) => effect(effectType.EFFECT, cb, deps)
export const useLayoutEffect = (cb, deps) => effect(effectType.LAYOUT, cb, deps)

function Effect(type) {
    this.type = type
    this.cb = null
    this.cleanup = null
    this.deps = { prev: null, next: null }
}

function effect(type, cb, deps) {
    const effect = (current.hooks.effects[cursor++] ??= new Effect(type))
    effect.cb = cb
    effect.deps.next = deps
}

/**
 * Ref
 */
export function useRef(initial = null) {
    return current.hooks.refs[cursor++] ??= { current: initial }
}

/**
 * State
 */
export function useState(initial) {
    const i = cursor++
    const hooks = current.hooks
    const states = hooks.states
    if (!states[i]) {
        states[i] = [
            initial,
            (data) => {
                if (!hooks.fiber) return
                states[i][0] = (typeof data === 'function')
                    ? data(states[i][0])
                    : data
                update(hooks.fiber)
            }
        ]
    }
    return states[i]
}

/**
 * Store
 */
export const storesWatchers = new WeakMap

export function createStore(Class) {
    const watchers = []
    let depth = 0
    getMethodsNames(Class).forEach(n => {
        const action = Class.prototype[n]
        Class.prototype[n] = function() {
            depth++
            const result = action.apply(this, arguments)
            depth--
            if (!depth && result !== null) watchers.forEach(update)
            return !depth ? this : result
        }
    })
    const store = new Class
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

export function loseStore(store, fiber) {
    const watchers = storesWatchers.get(store)
    const i = watchers.indexOf(fiber)
    if (~i) watchers.splice(i, 1)
}
