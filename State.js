import { currentComponent } from './container/types/Component'

// export const statesWatchers = new WeakMap()

// window.states = statesWatchers // Debug

export default function State(initialState) {

    // Create a local state, or use the previous one when updating the Component
    if (currentComponent) {

        const actualComponent = currentComponent // save refference
        const previousStates = actualComponent.previousStates
        const state = (previousStates.length) ? previousStates.shift() : {s: initialState}

        const setState = data => {
            state.s = data
            actualComponent.update()
        }

        actualComponent.states.push(state)
        return [state.s, setState]
    }

    // Create a global state
    /* const state = initialState || {}
    const watchers = []
    const setState = (data) => {

        if (typeof data === 'function') data(state)
        else Object.assign(state, data)

        watchers.forEach(container => update(container))
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
