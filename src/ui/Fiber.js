import { Text, Inline } from './Element'
import { hydration, queue } from "./renderer"

const nodes = {} // nodes pool
export const isReserved = prop => prop === 'children' || prop === 'html' || prop === 'memo'
export const isEventListener = prop => prop[0] === 'o' && prop[1] === 'n'

/**
 * Virtual DOM node
 */
export default class Fiber {

    constructor(element = {}, node, parent, toReplace) {
        this.type = element.type
        this.props = element.props
        this.key = element.key
        this.node = node
        this.parent = parent
        this.sibling = null
        this.child = null
        this.alt = null

        // Reconciliation
        this.insert = true
        this.toReplace = toReplace
        this.reuse = false
        this.rel = null

        // Component
        if (typeof this.type === 'function') {
            this.isComponent = true
            this.states = []
            this.effects = []
        }
    }

    clone(parent, nextProps, insert = false, toReplace) {

        // Reuse
        let reuse = false
        if (parent) { // not root
            // TODO: HERE decide whether to reuse or not

            if (this.type === Text && this.props.value === nextProps.value) reuse = true
            else if (this.props.memo && nextProps.memo) reuse = true

        }

        if (this.reuse = reuse) {
            queue.reuses.push([this, this.parent, this.sibling])
            this.parent = parent
            this.insert = insert
            this.toReplace = toReplace
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
        fiber.toReplace = toReplace

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
        this.toReplace = null
        this.reuse = false
    }

    /**
     * Creates a DOM node bound to the Fiber.
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
     * Applies changes to the DOM and schedules side effects.
     */
    update(nodeCursor, setNodeCursor) {
        // Reuse
        if (this.reuse) {
            if (this.isComponent) {
                const onEach = this.insert && (f => f.insertNode(nodeCursor))
                setNodeCursor(this.getLastNode(onEach))
            } else if (this.insert) this.insertNode(nodeCursor)
            return
        }

        // Schedule effects
        if (this.isComponent) {
            for (const e of this.effects) e?.fn && (e.sync
                ? queue.sync.push(e.fn)
                : queue.async.push(e.fn)
            )
            return
        }

        // Hydrate (bind the DOM node to the Fiber)
        if (hydration) {
            this.node = nodeCursor
            if (this.type === Text) {
                const len = this.props.value.length
                if (len < this.node.nodeValue.length) this.node.splitText(len)
                return
            }
            this.updateNode()
            return
        }

        // Insert or move the node, or replace another node
        if (this.insert) this.insertNode(nodeCursor)

        // Update Text value
        if (this.type === Text) {
            this.node.nodeValue = this.props.value
            return
        }

        // Update attributes
        this.updateNode()
    }

    /**
     * Inserts or Moves Fiber's node, or Replaces an another node with Fiber's.
     */
    insertNode(nodeCursor) {
        const parentNode = this.getParentNode()
        const toReplace = this.toReplace
        if (toReplace && !toReplace.isComponent) {
            toReplace.unmount(false)
            parentNode.replaceChild(this.node, toReplace.node)
            return
        }
        const relNode = nodeCursor
            ? nodeCursor.nextSibling
            : parentNode.firstChild
        parentNode.insertBefore(this.node, relNode)
    }

    /**
     * Applies JSX props to the Fiber's node.
     */
    updateNode() {
        const node = this.node
        const nextProps = this.props
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
    unmount(removeNode = true) {
        if (!this.isComponent) {
            this.walkDepth((fiber) => fiber.isComponent && fiber.cleanup())
            removeNode && this.node.parentNode.removeChild(this.node)
            return
        }
        const parentNode = this.getParentNode()
        this.walkDepth((fiber) => {
            if (fiber.isComponent) return fiber.cleanup()
            const node = fiber.node
            node.parentNode === parentNode && parentNode.removeChild(node)
        })
    }

    /**
     * Calls (sync) or schedules (async) each effect's cleanup function.
     */
    cleanup() {
        for (const e of this.effects) e?.cleanup && (e.sync
            ? e.cleanup()
            : queue.async.push(e.cleanup)
        )
        this.effects.length = 0
    }

    /**
     * Walks the Fiber and its subtree and applies the callback(s) to each fiber.
     */
    walkDepth(childFirst, parentFirst) {
        let fiber = this
        let goDeep = true

        // Node cursor
        let nodeCursor = hydration ? this.node : null
        const setNodeCursor = (node) => node && (nodeCursor = node)
        const nodeStack = []
        const beforeChild = hydration
            ? () => setNodeCursor(nodeCursor.firstChild)
            : () => nodeStack.push(nodeCursor) && (nodeCursor = null)
        const beforeSibling = hydration
            ? () => setNodeCursor(nodeCursor.nextSibling)
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
                // Perform parentFirst()
                // and don't go deeper if returned `null`, or if reusing
                if (parentFirst && parentFirst(fiber) === null || fiber.reuse) {
                    goDeep = false
                    continue
                }

                // Go deeper
                if (fiber.child) {
                    if (!fiber.isComponent) beforeChild()
                    fiber = fiber.child
                    continue
                }
            }

            // Perform childFirst()
            childFirst && childFirst(fiber, nodeCursor, setNodeCursor)

            // Go to the next sibling or to the parent
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
        let fiber = this.parent
        while (fiber.isComponent) fiber = fiber.parent
        return fiber.node
    }

    /**
     * Returns the last node of the Component.
     * At the same time, performs the callback on each non-Component Fiber.
     */
    getLastNode(onEach) {
        let lastNode = null
        this.reuse = false
        this.walkDepth(null, (fiber) => {
            if (fiber !== this && !fiber.isComponent) {
                onEach && onEach(fiber)
                lastNode = fiber.node
                return null
            }
        })
        return lastNode
    }
}