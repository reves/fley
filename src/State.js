import { currentFiber, dispatchUpdate } from './ui/renderer'

export const statesWatchers = new WeakMap()
window.states = statesWatchers // debug

export default function State(initial) {

    // Local
    if (currentFiber) {
        let fiber = currentFiber
        const index = fiber.hookIndex++
        const state = fiber.states.hasOwnProperty(index) ? fiber.states[index] : initial
        fiber.states[index] = state

        const setState = data => {
            while (fiber.next) fiber = fiber.next
            fiber.states[index] = typeof data === 'function' ? data(fiber.states[index]) : data            
            dispatchUpdate(fiber)
        }

        return [state, setState]
    }

    // Global
    const watchers = []

    const setState = data => {
        Object.assign(initial, (typeof data === 'function' ? data(initial) : data))
        watchers.forEach(fiber => dispatchUpdate(fiber))
    }

    statesWatchers.set(initial, watchers)

    return [initial, setState]
}

export function watch(globalState, ...globalStates) {

    if (!currentFiber) return
    if (currentFiber.watching.indexOf(globalState) !== -1) return
    
    currentFiber.watching.push(globalState)
    statesWatchers.get(globalState).push(currentFiber)

    globalStates.forEach(state => watch(state))
}
