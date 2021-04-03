import { currentComponent } from './container/types/Component'

// export const statesWatchers = new WeakMap()

// window.states = statesWatchers // Debug

export default function State(initialState) {

    // Create a local state, or use the previous one when updating the Component
    if (currentComponent) {

        const actualComponent = currentComponent // preserve the reference
        const previousStates = actualComponent.previousStates
        const state = previousStates.length ? previousStates.shift() : initialState
        const index = actualComponent.states.push(state) - 1

        const setState = data => {
            actualComponent.states[index] = typeof data === 'function' ? data(actualComponent.states[index]) : data
            actualComponent.update()
        }

        return [state, setState]
    }

    // Create a global state
    /* const state = typeof initialState === 'object' ? initialState : Object.create(initialState)
    const watchers = []

    const setState = (data) => {
        Object.assign(state, (typeof data === 'function' ? data(state) : data))
        watchers.forEach(component => component.update())
        return state
    }

    statesWatchers.set(state, watchers)
    return [state, setState] */
}

/* export function watch(state) {
    const watchers = statesWatchers.get(state)
    currentComponent.watching.push(state)
    if (previousComponent && watchers.indexOf(previousComponent) !== -1) return
    watchers.unshift(currentComponent)
}

export function unwatch(subComponents) {
    subComponents.forEach(component => {
        component.watching.forEach(state => {
            const watchers = statesWatchers.get(state)
            const index = watchers.indexOf(component)
            if (index !== -1) watchers.splice(index, 1)
        })
    })
} */
