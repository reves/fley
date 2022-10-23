import Fiber from '../ui/Fiber'
import Element from '../ui/Element'
import { update, setSyncOnly } from '../ui/renderer'
import { isBrowser } from '../utils'
import renderStatic from './renderStatic'

export default function hydrate(children, container) {
    if (!isBrowser) {
        setSyncOnly()
        try { console.log(JSON.stringify(renderStatic(children))) }
        catch (e) { console.error(e) }
        return
    }
    container = container || document.body
    update(new Fiber( new Element(null, { children }), container ), true)
}

export { isBrowser } from '../utils'