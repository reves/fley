import { currentComponent } from './container/types/Component'

export const statesWatchers = new WeakMap()

window.states = statesWatchers // Debug

export default function State(initial) {

    // Local state
    if (currentComponent) {

        const previousComponent = currentComponent.previousComponent

        // Use the previous state, when updating the Component
        if (previousComponent) {
            
            const state = previousComponent.states.length ? previousComponent.states.shift() : initial
            const index = currentComponent.states.push(state) - 1

            const setState = data => {
                const states = previousComponent.states
                states[index] = typeof data === 'function' ? data(states[index]) : data
                previousComponent.update()
            }

            return [state, setState]
        }

        const actualComponent = currentComponent // preserve the reference
        const state = initial
        const index = actualComponent.states.push(state) - 1

        const setState = data => {
            const states = actualComponent.states
            states[index] = typeof data === 'function' ? data(states[index]) : data
            actualComponent.update()
        }

        return [state, setState]
    }

    // Create a global state
    const state = typeof initial === 'object' ? initial : Object.create(initial)
    const watchers = []

    const setState = (data) => {
        Object.assign(state, (typeof data === 'function' ? data(state) : data))
        const indexes = []
        watchers.forEach(component => {
            if (!document.body.contains(component.children[0].node)) { // TODO: Redo this temporary solution
                indexes.push(watchers.indexOf(component))
                return
            }
            component.update()
        })
        indexes.forEach(i => watchers.splice(i, 1))
    }

    statesWatchers.set(state, watchers)

    return [state, setState]
}

export function watch(state) {

    const previousComponent = currentComponent.previousComponent
    const watchers = statesWatchers.get(state)

    if (!previousComponent) {
        watchers.push(currentComponent)
        currentComponent.watching.push(state)
        return
    }

    if (watchers.indexOf(previousComponent) !== -1) return

    watchers.push(previousComponent)
    currentComponent.watching.push(state)

}

export function unwatch() {
    // TODO
    // ...
}
