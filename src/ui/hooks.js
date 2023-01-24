import { current, update, queue } from './renderer'

// Most recent index of states/effects array.
let cursorState = 0, cursorEffect = 0
export const resetCursors = _ => cursorState = cursorEffect = 0

// Checks if two arrays have the same values.
const same = (prev, next) => prev
    && prev.length === next.length
    && prev.every((p, i) => p === next[i])

// Calls the callback if the value has changed.
const didChange = (prev, data, fn) => {
    if (data === undefined) return
    data = typeof data === 'function' ? data(prev) : data
    if (typeof prev === 'object' || prev !== data) fn(data)
}

// Defines reactive actions on the target object.
const defineActions = (target, actions, dispatch) => {
    for (const name in actions) {
        const action = actions[name]
        target[name] = function(){dispatch(action, arguments)}
    }
    return target
}

const getStates = _ => [current.states, cursorState++]

/**
 * State
 */
export const useState = (initial, actions) => {
    const [states, i] = getStates()
    if (i in states) return states[i]
    const actual = current.actual
    const state = [typeof initial === 'function' ? initial() : initial]
    const setState = (data) => didChange(state[0], data, (nextValue) => {
        state[0] = nextValue
        update(actual[0])
    })
    state[1] = actions
        ? defineActions(setState, actions, (action, args) => {
            setState(action(state[0], ...args))
        })
        : setState
    return states[i] = state
}

export const useMemo = (fn, deps) => {
    const [states, i] = getStates()
    const memo = (states[i] ??= [])
    if (same(memo[1], deps)) return memo[0]
    memo[1] = deps
    return memo[0] = fn()
}

export const useCallback = (fn, deps) => useMemo(() => fn, deps)

export const useRef = (value) => {
    const [states, i] = getStates()
    return states[i] ??= (data) => data === undefined ? value : (value = data)
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
            effect.fn = null // free memory
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

/**
 * Store
 */
export const createValue = (value, actions) => {
    const watchers = new Set()
    const setValue = (data) => didChange(value, data, (nextValue) => {
        value = nextValue
        new Set(watchers).forEach((actual) => update(actual[0]))
    })
    const ref = (data) => {
        if (!current) return data === undefined ? value : setValue(data)
        const actual = current.actual
        useLayoutEffect(() => {
            watchers.add(actual)
            return () => watchers.delete(actual)
        }, (actual[0].type === ref) ? [] : null)
        return value
    }
    if (actions) {
        defineActions(ref, actions, (action, args) => 
            setValue(action(value, ...args)))
    }
    return ref
}

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
        new Set(watchers).forEach((actual) => update(actual[0]))
    }
    store.action._watchers = watchers
    return store
}

export const useStore = (store) => {
    const actual = current.actual
    useLayoutEffect(() => {
        const watchers = store.action._watchers
        watchers.add(actual)
        return () => watchers.delete(actual)
    }, [])
}