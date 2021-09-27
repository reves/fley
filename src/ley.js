import Fiber from './ui/Fiber'
import { normalize } from './ui/Element'
import { dispatchUpdate } from './ui/renderer'

export default function ley(rootElementId, children) {

    const rootElement = document.getElementById(rootElementId)
    rootElement.innerHTML = ''

    const rootFiber = new Fiber
    rootFiber.node = rootElement
    rootFiber.props = { children: normalize(children) }

    dispatchUpdate(rootFiber)
}

export { Fragment, Inline } from './ui/Element'
