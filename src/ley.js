import Fiber from './ui/Fiber'
import { normalize } from './ui/Element'
import { currentFiber, dispatchUpdate } from './ui/renderer'

export default function ley(children) {

    document.body.innerHTML = ''

    const rootFiber = new Fiber
    rootFiber.node = document.body
    rootFiber.props = { children: normalize(children) }

    dispatchUpdate(rootFiber)
}

export function useRef(initial = null) {
    return { current: initial }
}

export function useEffect(effect, dependencies = null) {

    if (!currentFiber) return

    const index = currentFiber.hookIndex++

    currentFiber.effects[index] = effect
    currentFiber.effectsDependencies[index] = dependencies
}

export { Fragment, Inline } from './ui/Element'
