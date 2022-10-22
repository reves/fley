import Fiber from './ui/Fiber'
import Element from './ui/Element'
import { update, setSyncOnly } from './ui/renderer'

export default function ley(children, container = document.body) {
    container.innerHTML = ''
    update(new Fiber( new Element(null, { children }), container ))
}

export function leySync(...args) {
    setSyncOnly()
    ley(...args)
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