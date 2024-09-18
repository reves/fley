import Element from './Element'
import { createRoot } from './Fiber'
import { update, queue, hydration } from './renderer'
import { createValue } from './hooks'
import { isPlaceholder } from '../utils'

function createHeadValue(initial) {
    let scheduled = false
    const value = createValue(initial)
    value.root = createRoot(value)
    value.next = initial
    value.schedule = function(next, onCommit) {
        this.next = next ?? initial
        if (!scheduled) {
            scheduled = true
            queue.sync.push(() => onCommit(this.next))
            queue.reset.push(() => {
                scheduled = false
                this.next = initial
            })
        }
    }
    return value
}

/**
 * Title
 */
export let title = null
let defaultTitle = ''

export const useTitle = (next) => {
    title ??= createHeadValue(defaultTitle)
    title.schedule(next, updateTitle)
}

function updateTitle(next) {
    title(next)
    const root = title.root
    if (root.node) return
    defaultTitle = document.title
    if (hydration) {
        if (isPlaceholder(next)) next(defaultTitle)
        defaultTitle = ''
    }
    document.title = defaultTitle // ensures title node exists
    root.node = document.head.querySelector('title')
    update(root)
}

/**
 * Schema
 */
export let schema = null
const SCHEMA_TYPE = 'application/ld+json'

export const useSchema = (next) => {
    schema ??= createHeadValue('')
    schema.schedule(next, updateSchema)
}

function updateSchema(next) {
    schema(JSON.stringify(next))
    const root = schema.root
    if (root.node) return
    let node = document.head.querySelector('script[type="' + SCHEMA_TYPE + '"]')
    if (hydration) {
        if (isPlaceholder(next)) next(JSON.parse(node.text))
    } else if (!node) {
        node = document.createElement('script')
        node.type = SCHEMA_TYPE
        document.head.appendChild(node)
    }
    root.node = node
    node.text = ''
    update(root)
}

/**
 * Meta
 */
export let meta = null

export const useMeta = (next) => {
    meta ??= createHeadValue([])
    meta.schedule(next, updateMeta)
}

function updateMeta(next) {
    const elements = []
    for (const props of next) elements.push(new Element('meta', props))
    meta(elements)
    const root = meta.root
    if (root.node) return
    root.node = document.head
    for (const props of next) {
        let attr = ''
        for (const key in props) {
            if (key !== 'content') { attr = key; break }
        }
        const query = 'meta[' + attr + '="' + props[attr] + '"]'
        let node = document.head.querySelector(query)
        if (hydration) {
            for (const key in props) {
                const v = props[key]
                if (isPlaceholder(v)) v(node.getAttribute(key))
            }
        }
        if (node) document.head.removeChild(node)
    }
    update(root)
}