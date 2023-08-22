import { createRoot } from '../ui/Fiber'
import { update } from '../ui/renderer'
import renderStatic from './renderStatic'
import { isBrowser } from '../utils'

export default function hydrate(children, container) {
    if (isBrowser) {
        container = container || document.body
        update(createRoot(children, container), true)
        return
    }
    try { renderStatic(children) }
    catch (e) { console.error(e) }
}

export { isBrowser } from '../utils'