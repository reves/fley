import { Text, Inline } from './Element'
import { hydration, queue } from "./renderer"

const nodes = {} // nodes pool
export const isReserved = prop => prop === 'children' || prop === 'html' || prop === 'memo'
export const isEventListener = prop => prop[0] === 'o' && prop[1] === 'n'

/**
 * Virtual DOM node
 */
export default class Fiber {

    constructor(elementOrFiber, node, parent, toReplace) {
        this.type = elementOrFiber.type
        this.props = elementOrFiber.props
        this.key = elementOrFiber.key
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
            this.actual = [ this ] // ref to the latest version
        }
    }

    clone(parent, element, insert = false, toReplace) {
        // Reuse check
        if (parent) {
            const prevProps = this.props
            const nextProps = element.props
            let reuse = false

            switch (this.type) {
                case Text: // reuse (true), or reuse and update text (1)
                    reuse = (prevProps.value === nextProps.value) ? true : 1
                    break
                case Inline:
                    if (prevProps.html !== nextProps.html) 
                        return new Fiber(element, null, parent, this)
                    if (!prevProps.length && !nextProps.length) {
                        reuse = true
                        break
                    }
                default:
                    if (prevProps.memo && nextProps.memo) reuse = true
            }

            if (this.reuse = reuse) {
                const _parent = this.parent, _sibling = this.sibling, _props = prevProps
                queue.cancel.push(() => {
                    this.parent = _parent
                    this.sibling = _sibling
                    this.props = _props
                    this.reset()
                })
                this.parent = parent
                this.insert = insert
                this.toReplace = toReplace
                this.props = nextProps
                return this
            }
        }

        // Fiber clone
        const fiber = new Fiber(element ?? this, this.node, parent ?? this.parent)
        fiber.alt = this

        // Reconciliation
        fiber.insert = insert
        fiber.toReplace = toReplace

        // Component
        if (this.isComponent) {
            fiber.isComponent = true
            fiber.states = this.states
            fiber.effects = this.effects
            fiber.actual = this.actual
        }

        return fiber
    }

    reset() {
        this.props.children &&= null // free memory
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
        // Reusing
        const reuse = this.reuse
        if (reuse) {
            if (this.isComponent) {
                const onEach = this.insert && (f => f.insertNode(nodeCursor))
                setNodeCursor(this.getLastNode(onEach))
                return
            }
            if (this.insert) this.insertNode(nodeCursor)
            if (this.type === Text && reuse === 1) {
                this.node.nodeValue = this.props.value
            }
            return
        }

        // Schedule effects
        if (this.isComponent) {
            for (const e of this.effects) e?.fn && (e.sync
                ? queue.sync.push(e.fn)
                : queue.async.push(e.fn)
            )
            this.actual[0] = this // Update ref
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

        // Update attributes
        this.updateNode()
    }

    /**
     * Inserts or Moves Fiber's node, or Replaces an another node with Fiber's.
     */
    insertNode(nodeCursor) {
        const parentNode = this.getParentNode()

        if (this.alt && this.type === Inline) {
            console.log(this.alt)
            parentNode.replaceChild(this.node, this.alt.node)
            return
        }

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
        this.effects = null
        this.states = null
        this.actual = null
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