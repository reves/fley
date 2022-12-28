import { hydration, queue } from './renderer'
import { isBrowser } from '../utils'

const headNode = isBrowser ? document.head : null
const metaNode = isBrowser ? document.createElement('meta') : null
let initialTitle = isBrowser ? document.title : ''
let schemaNode = isBrowser ? document.createElement('script') : null
const schemaType = 'application/ld+json'
isBrowser && (schemaNode.type = schemaType)

class Head {

    constructor() {
        this.reset()
        this.metaNodes = []
        queue.reset.push(this.reset.bind(this))
    }

    reset() {
        this.title = initialTitle
        this.meta = []
        this.schema = null
        this.scheduled = false
    }

    schedule() {
        if (this.scheduled) return
        this.scheduled = true
        if (hydration) {
            queue.sync.push(this.hydrate.bind(this))
            return
        }
        queue.sync.push(this.update.bind(this))
    }

    update() {
        // Title
        document.title = this.title

        // Meta
        for(const node of this.metaNodes) headNode.removeChild(node)
        this.metaNodes.length = 0
        for (const props of this.meta) {
            const node = metaNode.cloneNode()
            for (const prop in props) node.setAttribute(prop, props[prop])
            this.metaNodes.push(node)
            headNode.appendChild(node)
        }

        // Schema
        if (this.schema) {
            schemaNode.text = JSON.stringify(this.schema)
            headNode.appendChild(schemaNode)
        } else if (schemaNode.text) {
            headNode.removeChild(schemaNode)
            schemaNode.text = ''
        }
    }

    hydrate() {
        // Title
        initialTitle = ''

        // Meta
        for (const props of this.meta) {
            for (const prop in props) {
                if (prop === 'content') continue
                const query = 'meta[' + prop + '="' + props[prop] + '"]'
                const node = headNode.querySelector(query)
                node && this.metaNodes.push(node)
                break
            }
        }

        // Schema
        const node = headNode.querySelector('script[type="' + schemaType + '"]')
        if (node) schemaNode = node
    }
}

const head = new Head
export const useTitle = (title = '') => { head.title = title; head.schedule() }
export const useMeta = (meta = []) => { head.meta = meta; head.schedule() }
export const useSchema = (schema) => { head.schema = schema; head.schedule() }
export default head