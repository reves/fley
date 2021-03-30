import { is } from './utils'
import update from './container/update'
import { currentComponent, previousComponent } from './container/types/Component'

export const statesWatchers = new WeakMap()

window.states = statesWatchers

export default function State(initialState) {

    if (currentComponent) {

        const state = (previousComponent && previousComponent.states.length) ? previousComponent.states.shift() : {s: initialState}
        const actualComponent = currentComponent

        currentComponent.states.push(state)

        function setState(newState) {
            state.s = newState
            update(actualComponent)
        }

        return [state.s, setState]
    }

    const state = initialState
    const watchers = []

    statesWatchers.set(state, watchers)

    function setState(newState = {}) {

        Object.assign(state, newState)

        watchers.forEach(container => {

            if (container.getDependencies == null) return update(container)
            if (typeof container.getDependencies !== 'function') return

            let diff = false
            let dependencies = container.getDependencies()
            dependencies = (dependencies instanceof Array) ? dependencies : [dependencies]

            for (let i=0; i<container.prevDependencies.length; i++) {

                if (!is(container.prevDependencies[i], dependencies[i])) {
                    diff = true
                    break
                }
            }

            diff && update(container)
            container.prevDependencies = dependencies
        })

        return state
    }

    return [state, setState]
}

export function watch(state) {
    const watchers = statesWatchers.get(state)
    const index = watchers.indexOf(previousComponent)
    if (index !== -1) watchers.splice(index, 1)
    watchers.push(currentComponent)
}
