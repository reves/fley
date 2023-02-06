import { current, update, queue } from './renderer'
import { isFunction, isObject, isUndefined, defineProperty, getOwnProperties, seal } from '../utils'

// Most recent indexes of states & effects arrays.
let cursorState = 0, cursorEffect = 0
export const resetCursors = _ => cursorState = cursorEffect = 0

// Checks if two arrays have the same values.
const same = (prev, next) =>
    prev && prev.length === next.length && prev.every((p, i) => p === next[i])

/**
 * State
 */
export const useMemo = (fn, deps) => {
    const states = current.states
    const i = cursorState++
    const state = i in states
        ? states[i]
        : (states[i] = deps ? [fn(), deps] : fn())
    if (!deps) return state
    if (same(state[1], deps)) return state[0]
    state[1] = deps
    return state[0] = fn()
}

export const useCallback = (fn, deps) => useMemo(() => fn, deps)

/**
 * Ref
 */
let condition = null // condition to update the Component
export const withCondition = (cond) => condition = cond

const updateActual = (actual) => {
    const fiber = actual[0]
    if (!condition || condition(fiber.props, fiber.key)) update(fiber)
}

const watch = (watchers, ref) => {
    const actual = current.actual
    const isSelf = (ref && ref === actual[0].type)
    if (isSelf || !watchers.has(actual)) {
        useLayoutEffect(() => {
            watchers.add(actual)
            return () => watchers.delete(actual)
        }, isSelf ? [] : null)
    }
}

const createRef = (value, actions, watchers, watch) => {
    if (isFunction(value)) value = value()

    // Ref
    const ref = (next) => {
        if (current) {
            watch && watch(watchers, ref)
            return value
        }
        if (isUndefined(next)) return value
        if (isFunction(next)) next = next(value)
        if (watchers) {
            if (value !== next || isObject(value) && isObject(next)) {
                value = next
                const list = Array.isArray(watchers) ? watchers : new Set(watchers)
                list.forEach(updateActual)
            }
        } else value = next
    }

    // Actions
    if (actions) {
        let depth = 0
        for (const name in actions) {
            const action = actions[name]
            ref[name] = isFunction(action)
                ? function() {
                    depth++
                    const result = action.apply(this, depth === 1
                        ? [value, ...arguments]
                        : arguments)
                    depth--
                    if (depth) return result
                    ref(result)
                    condition = null
                    return this
                }
                : action
        }
    }

    return seal(ref)
}

export const useRef = (initial) => useMemo(() => createRef(initial))

export const useState = (initial, actions) => {
    const ref = useMemo(() => createRef(initial, actions, [current.actual]))
    return [ref(), ref]
}

export const createValue = (initial, actions) => {
    const watchers = new Set()
    return createRef(initial, actions, watchers, watch)
}

export const createStore = (Store, ...args) => {
    const watchers = new Set()
    const store = new Store(...args)

    // Properties
    for (const prop of getOwnProperties(store)) {
        let value = store[prop]
        defineProperty(store, prop, {
            get() {
                current && watch(watchers)
                return value
            },
            set(next) { value = next },
            enumerable: true
        })
    }

    // Actions
    let depth = 0
    let prototype = Store.prototype
    while (prototype.constructor !== Object) {
        for (const name of getOwnProperties(prototype).slice(1)) {
            const action = prototype[name]
            defineProperty(store, name, {
                value() {
                    depth++
                    const result = action.apply(this, arguments)
                    depth--
                    if (depth) return result
                    if (result !== null) this.action()
                    return this
                }
            })
        }
        prototype = Object.getPrototypeOf(prototype)
    }
    defineProperty(store, 'action', {
        value(fn) {
            fn && fn()
            new Set(watchers).forEach(updateActual)
            condition = null
        }
    })

    return seal(store)
}

/**
 * Effect
 */
function Effect(sync = false) {
    this.sync = sync
    this.fn = null
    this.cleanup = null
    this.deps = null
}

const _useEffect = (fn, deps, sync) => {
    const effect = current.effects[cursorEffect++] ??= new Effect(sync)
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
            effect.fn = null // free retained memory
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

export const useEffect = (fn, deps) => _useEffect(fn, deps)
export const useLayoutEffect = (fn, deps) => _useEffect(fn, deps, true)