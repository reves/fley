import Fiber from './ui/Fiber'
import Element from './ui/Element'
import { update, setSyncOnly } from './ui/renderer'

export default function ley(children, container = document.body) {
    container.innerHTML = ''
    update(new Fiber( new Element(null, { children }), container))
}

export const Sync = ({ children }) => setSyncOnly() && children

export {
    useEffect,
    useLayoutEffect,
    useState,
    useMemo,
    useCallback,
    useRef,
    createValue,
    createStore,
    withCondition
} from './ui/hooks'
export { Fragment, Inline } from './ui/Element'