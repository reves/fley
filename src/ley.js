import Fiber from './ui/Fiber'
import Element from './ui/Element'
import { update } from './ui/renderer'

export default function ley(children, root = document.body) {
    root.innerHTML = ''
    update( new Fiber( new Element(null, { children }), root) )
}

export {
    useState,
    useRef,
    useEffect,
    useLayoutEffect,
    useStore,
    createStore
} from './ui/hooks'
export { Fragment, Inline } from './ui/Element'
