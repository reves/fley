import Fiber from '../ui/Fiber'
import Element from '../ui/Element'
import { update } from '../ui/renderer'
import renderStatic from './renderStatic'
import { isBrowser } from '../utils'

export default function hydrate(children, container) {
    if (isBrowser) {
        container = container || document.body
        update(new Fiber( new Element(null, { children }), container ), true)
        return
    }
    try { renderStatic(children) }
    catch (e) { console.error(e) }
}

export { isBrowser } from '../utils'