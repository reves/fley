import update from './container/update'

function is(x, y) {
    return (
        (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y)
    )
}

export default function State(state = {}) {

    state._watchers = []

    function setState(newState = {}) {

        Object.assign(state, newState)

        state._watchers.forEach(container => {

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

    }

    return [state, setState]
}
