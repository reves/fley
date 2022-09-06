import Fiber from './ui/Fiber'
import Element from './ui/Element'
import { update } from './ui/renderer'

export default function ley(children, root = document.body) {
    root.innerHTML = ''
    update( new Fiber( new Element(null, { children }), root) )
}

export {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useReducer,
    useMemo,
    useCallback,
    useStore,
    createStore
} from './ui/Hooks'
export { Fragment, Inline } from './ui/Element'
