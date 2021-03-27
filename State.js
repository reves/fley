import { is } from './utils'
import update from './container/update'

export const statesWatchers = new WeakMap()

export default function State(state) {

    const watchers = []

    state = new Object(state)
    statesWatchers.set(state, watchers)

    function setState(newState) {

        newState = new Object(newState)
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
