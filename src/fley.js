import { createRoot } from './ui/Fiber'
import { update, current } from './ui/renderer'

export default function fley(children, container = document.body) {
    container.innerHTML = ''
    update(createRoot(children, container))
}

export const Sync = ({ children }) => (current.sync = true) && children
export { Inline } from './ui/Element'
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
export { useTitle, useMeta, useSchema } from './ui/head'
