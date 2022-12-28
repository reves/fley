import { Text, Inline } from './Element'
import { hydration, queue } from "./renderer"

const nodes = {} // nodes pool
export const isReserved = prop => prop === 'children' || prop === 'html'
export const isEventListener = prop => prop[0] === 'o' && prop[1] === 'n'

/**
 * Virtual DOM node
 */
export default class Fiber {

    constructor(element = {}, node, parent, insert = false, replace) {
        this.type = element.type
        this.props = element.props
        this.key = element.key
        this.node = node
        this.parent = parent
        this.sibling = null
        this.child = null
        this.alt = null

        // Reconciliation
        this.insert = insert
        this.replace = replace?.isComponent ? null : replace // TODO: replace components also
        this.reuse = false
        this.rel = null

        // Component
        if (typeof this.type === 'function') {
            this.isComponent = true
            this.states = []
            this.effects = []
        }
    }

    clone(parent, nextProps, insert = false, replace) {
        // Reuse
        const reuse = false
        // TODO: HERE decide whether to reuse or not
        // (!) Imporatnt: if !parent ---> don't reuse (because it's root)
        // ...
        if (reuse) {
            this.reuse = reuse
            queue.reuses.push(this)
            return this
        }

        // Fiber clone
        const fiber = new Fiber
        fiber.type = this.type
        fiber.props = nextProps ?? this.props
        fiber.key = this.key
        fiber.node = this.node
        fiber.parent = parent ?? this.parent
        fiber.alt = this

        // Reconciliation
        fiber.insert = insert
        fiber.replace = replace?.isComponent ? null : replace // TODO: replace components also

        // Component
        if (this.isComponent) {
            fiber.isComponent = true
            fiber.states = this.states
            fiber.effects = this.effects
        }

        return fiber
    }

    reset() {
        this.props.children &&= null // free memory // TODO: check if this prop is needed for memo props comparison
        this.alt = null
        this.insert = false
        this.replace = null
        this.reuse = false
        this.rel = null
    }

    /**
     * Applies changes to the DOM and manages side effects.
     */
    update(nodeCursor) {
        if (this.parent?.isComponent) this.insert = this.parent.insert
        if (this.isComponent) {
            for (const e of this.effects) {
                e?.fn && (e.sync ? queue.sync.push(e.fn) : queue.async.push(e.fn))
            }
            return
        }

        if (hydration) {
            this.node = nodeCursor
            if (this.type === Text) {
                const len = this.props.value.length
                if (len < this.node.nodeValue.length) this.node.splitText(len)
            }
            this.updateNode()
            return
        }

        this.updateNode()

        if (this.insert) {
            const parentNode = this.getParentNode()
            const replace = this.replace
            if (replace) {
                parentNode.replaceChild(this.node, replace.node)
                return
            }
            const relNode = nodeCursor
                ? nodeCursor.nextSibling
                : parentNode.firstChild
            parentNode.insertBefore(this.node, relNode)
        }
    }

    /**
     * Creates a DOM node.
     */
    createNode() {
        if (this.type === Text) {
            this.node = (nodes.text ??= document.createTextNode('')).cloneNode()
            this.node.nodeValue = this.props.value
            return
        }
        if (this.type === Inline) {
            const tpl = nodes.template ??= document.createElement('template')
            tpl.innerHTML = this.props.html
            this.node = tpl.content.firstChild
            tpl.innerHTML = ''
            return
        }
        const node = nodes[this.type] ??= document.createElement(this.type)
        this.node = node.cloneNode()
    }

    /**
     * Applies JSX props to the Fiber's node.
     */
    updateNode() {
        const node = this.node
        const nextProps = this.props

        if (this.type === Text) {
            if (!hydration && (String(nextProps.value) !== node.nodeValue)) {
                node.nodeValue = nextProps.value
            }
            return
        }

        const prevProps = this.alt?.props ?? {}

        // Obsolete props
        for (const prop in prevProps) {
            if (isReserved(prop)) continue
            const value = prevProps[prop]

            // Unset Ref
            if (prop === 'ref') {
                value(null)
                continue
            }

            // Unset event listener
            if (isEventListener(prop)) {
                node[prop.toLowerCase()] = null
                continue
            }

            // Skip props that will remain
            if (prop in nextProps) continue

            // Remove attribute
            node.removeAttribute(prop)
        }

        // Updated props
        for (const prop in nextProps) {
            if (isReserved(prop)) continue
            const value = nextProps[prop]

            // Ref
            if (prop === 'ref') {
                value(node)
                continue
            }

            // Event listener
            if (isEventListener(prop)) {
                node[prop.toLowerCase()] = value
                continue
            }

            // Skip same values
            if (prop in prevProps && Object.is(value, prevProps[prop])) {
                continue
            }

            if (hydration) continue

            // Attribute
            if (prop === 'value') {
                node.value = value
            } else if (typeof value === 'boolean' && value) {
                node.setAttribute(prop, '')
            } else if (value != null) {
                node.setAttribute(prop, value)
            } else {
                node.removeAttribute(prop)
            }
        }
    }

    /**
     * Removes Fiber's node(s) from the DOM and unmounts Components.
     */
    unmount() {
        const childFirst = (fiber) => {
            if (!fiber.isComponent) return
            for (const e of fiber.effects) {
                e?.cleanup && (e.sync ? e.cleanup() : queue.async.push(e.cleanup))
            }
            fiber.effects.length = 0
        }

        if (!this.isComponent) {
            this.walkDepth(childFirst)
            this.node.parentNode.removeChild(this.node)
            return
        }

        const parentNode = this.getParentNode()
        const parentFirst = (fiber) => {
            if (fiber.isComponent) return
            const node = fiber.node
            parentNode === node.parentNode && parentNode.removeChild(node)
        }

        this.walkDepth(childFirst, parentFirst)
    }

    /**
     * Walks the subtree and applies the callback(s) to each fiber.
     */
    walkDepth(childFirst, parentFirst) {
        // TODO: skip reused:
        // ... if .insert === true, don't skip fibers of closest child nodes
        // ... but skip their subtrees anyway
        let fiber = this
        let goDeep = true

        // Node cursor
        let nodeCursor = hydration ? this.node : null
        const nodeStack = []
        const beforeChild = hydration
            ? () => nodeCursor = nodeCursor.firstChild ?? nodeCursor
            : () => nodeStack.push(nodeCursor) && (nodeCursor = null)
        const beforeSibling = hydration
            ? () => nodeCursor = nodeCursor.nextSibling ?? nodeCursor
            : () => nodeCursor = fiber.node
        const beforeParent = hydration
            ? () => {
                if (fiber.isComponent) return
                if (fiber.parent.isComponent) {
                    nodeCursor = nodeCursor.nextSibling ?? nodeCursor.parentNode
                    return
                }
                nodeCursor = nodeCursor.parentNode
            } 
            : () => {
                if (!fiber.isComponent) nodeCursor = fiber.node
                if (!fiber.parent.isComponent) nodeCursor = nodeStack.pop()
            }

        // Walk
        while (true) {
            if (goDeep) {
                parentFirst && parentFirst(fiber)
                if (fiber.child) {
                    if (!fiber.isComponent) beforeChild()
                    fiber = fiber.child
                    continue
                }
            }
            childFirst && childFirst(fiber, nodeCursor)
            while (true) {
                if (fiber === this) return
                if (fiber.sibling) {
                    if (!fiber.isComponent) beforeSibling()
                    fiber = fiber.sibling
                    goDeep = true
                    break
                }
                beforeParent()
                fiber = fiber.parent
                goDeep = false
                break
            }
        }
    }

    /**
     * Returns the closest parent node.
     */
    getParentNode() {
        let fiber = this
        while (!fiber.parent.node) fiber = fiber.parent
        return fiber.parent.node
    }
}