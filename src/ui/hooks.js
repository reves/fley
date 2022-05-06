import { currentFiber, update } from './renderer'

let hookIndex = 0
export const resetHookIndex = _ => hookIndex = 0

// Effect
function Effect(effect, deps) {
    this.effect = effect
    this.deps = deps
    this.cleanup = null
}

export function useEffect(effect, deps = null) {
    currentFiber.hooks.effects[hookIndex++] = new Effect(effect, deps)
}

export function useLayoutEffect(effect, deps = null) {
    currentFiber.hooks.layoutEffects[hookIndex++] = new Effect(effect, deps)
}

// Ref
export function useRef(initial = null) {
    return currentFiber.hooks.ref[hookIndex++] ??= { current: initial }
}

// State
export function useState(initial) {
    const index = hookIndex++
    const fiber = currentFiber
    const state = fiber.hooks.states.hasOwnProperty(index)
        ? fiber.hooks.states[index]
        : fiber.hooks.states[index] = initial
    const setState = (data) => {
        fiber.hooks.states[index] = (typeof data === 'function')
            ? data(fiber.hooks.states[index])
            : data
        update(fiber)
    }
    return [state, setState]
}

// Store
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

function getMethodsNames(Class) {
    const names = []
    let prototype = Class.prototype
    while (prototype.constructor !== Object) {
        names.push(...Object.getOwnPropertyNames(prototype))
        prototype = Object.getPrototypeOf(prototype)
    }
    return names.filter(n => n !== 'constructor')
}

export function useStore(store) {
    if (currentFiber.alt) return
    let fiber = currentFiber
    while (fiber) {
        if (fiber.isComponent && ~fiber.hooks.stores.indexOf(store)) return
        fiber = fiber.parent
    }
    currentFiber.hooks.stores.push(store)
    storesWatchers.get(store).push(currentFiber)
}

export function loseStore(store, fiber) {
    const watchers = storesWatchers.get(store)
    const index = watchers.indexOf(fiber)
    if (~index) watchers.splice(index, 1)
}
