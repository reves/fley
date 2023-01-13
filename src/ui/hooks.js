import { current, update, queue } from './renderer'

// Current hook index of the current Fiber.
let cursor = 0
export const resetCursor = _ => cursor = 0

// Checks if arrays are the same.
const same = (prev, next) => prev
    && prev.length === next.length
    && prev.every((p, i) => p === next[i])

/**
 * State
 */
const getStates = _ => [current.states, cursor++]

export const useState = (initialValue) => useReducer(false, initialValue)

export const useReducer = (reducer, initialValue, init) => {
    const [states, i] = getStates()
    if (i in states) return states[i]
    if (typeof initialValue === 'function') initialValue = initialValue()
    const actual = current.actual
    const getNextValue = reducer
        ? (prev, data) => reducer(prev, data) // here data means action
        : (prev, data) => ((typeof data === 'function') ? data(prev) : data)
    const state = [
        init ? init(initialValue) : initialValue,
        (data) => {
            const prev = state[0]
            const next = getNextValue(prev, data)
            if (prev === next && typeof prev !== 'object') return
            state[0] = next
            update(actual[0])
        }
    ]
    return states[i] = state
}

export const useRef = (initialValue) => {
    const [states, i] = getStates()
    if (i in states) return states[i]
    const ref = function(value) {
        if (arguments.length) ref.current = value
        return ref.current
    }
    ref.current = initialValue
    return states[i] = ref
}

export const useMemo = (fn, deps) => {
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
export const createStore = (StoreClass, ...args) => {
    // Wrap non-static methods (including extended ones)
    if (!StoreClass._ley) {
        StoreClass._ley = true
        const prototype = StoreClass.prototype

        // Get methods
        let methods = []
        let p = prototype
        while (p.constructor !== Object) {
            methods.push(...Object.getOwnPropertyNames(p))
            p = Object.getPrototypeOf(p)
        }

        // Wrap methods
        let depth = 0
        for (const method of methods.filter(m => m !== 'constructor')) {
            const action = prototype[method]
            prototype[method] = function() {
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
    const watchers = new Set
    store.action = (fn) => {
        fn && fn()
        new Set(watchers)
            .forEach(([actual, condition]) => {
                const fiber = actual[0]
                condition
                    ? condition(fiber.props) && update(fiber)
                    : update(fiber)
            })
    }
    store.action._watchers = watchers
    return store
}

export const useStore = (store, condition) => {
    const actual = current.actual
    useLayoutEffect(() => {
        const watchers = store.action._watchers
        const entry = [actual, condition]
        watchers.add(entry)
        return () => watchers.delete(entry)
    }, [])
}