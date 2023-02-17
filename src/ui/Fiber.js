import { Text, Inline } from './Element'
import { hydration, queue } from "./renderer"
import { isFunction } from '../utils'

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
        this.isSvg = parent?.isSvg || this.type === 'svg'
        this.sync = elementOrFiber.sync || parent?.sync

        // Reconciliation
        this.alt = null
        this.insert = true
        this.toReplace = toReplace
        this.memo = false // skip update stage and subtree reconciliation
        this.skip = false

        // Component
        if (isFunction(this.type)) {
            this.isComponent = true
            this.states = []
            this.effects = []
            this.actual = [this] // ref to the latest cloned version
        }
    }

    clone(parent, element, insert = false, toReplace) {
        // Memoization check
        let memoize = false
        if (parent) {
            const prevProps = this.props
            const nextProps = element.props
            switch (this.type) {
                case Text: break
                case Inline:
                    if (prevProps.html !== nextProps.html) 
                        return new Fiber(element, null, parent, this)
                default:
                    const memo = nextProps.memo
                    if (prevProps.memo && memo) {
                        memoize = (isFunction(memo))
                            ? memo(prevProps, nextProps)
                            : true
                    }
            }
        }

        // Create a clone
        const fiber = new Fiber(element ?? this, this.node, parent ?? this.parent, toReplace)

        // Reconciliation
        fiber.alt = this
        fiber.insert = insert
        fiber.memo = memoize

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
        this.alt = null
        this.memo = false
        this.insert = false
        this.toReplace = null
    }

    /**
     * Creates a DOM node bound to the Fiber.
     */
    createNode() {
        const doc = document
        const type = this.type
        const isSvg = this.isSvg
        if (type === Text) {
            this.node = isSvg
                ? doc.createTextNode('')
                : (nodes._ ??= doc.createTextNode('')).cloneNode()
            this.node.nodeValue = this.props.value
            return
        }
        if (type === Inline) {
            const tpl = nodes.template ??= doc.createElement('template')
            tpl.innerHTML = this.props.html
            this.node = tpl.content.firstChild
            tpl.innerHTML = ''
            return
        }
        this.node = isSvg
            ?  doc.createElementNS('http://www.w3.org/2000/svg', type)
            : (nodes[type] ??= doc.createElement(type)).cloneNode()
    }

    /**
     * Applies changes to the DOM and schedules side effects.
     */
    update(nodeCursor, setNodeCursor) {
        const memoized = this.memo

        // Update relations
        if (memoized) {
            let child = (this.child = this.alt.child)
            while (child) {
                child.parent = this
                child = child.sibling
            }
        }

        if (this.isComponent) {
            if (memoized) {
                const onEach = this.insert && (f => f.insertNode(nodeCursor))
                setNodeCursor(this.getLastNode(onEach))
            } else {
                // Schedule effects
                for (const e of this.effects) e.fn && (e.sync
                    ? queue.sync.push(e.fn)
                    : queue.async.push(e.fn)
                )
            }
            // Update version
            if (this.isComponent) this.actual[0] = this
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
        if (!memoized) this.updateNode()
    }

    /**
     * Inserts or Moves Fiber's node, or Replaces an another node with Fiber's.
     */
    insertNode(nodeCursor) {
        const parentNode = this.getParentNode()
        const toReplace = this.toReplace
        if (toReplace && !toReplace.isComponent) {
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

        if (this.type === Text) {
            const value = nextProps.value
            if (prevProps.value !== value) this.node.nodeValue = value
            return
        }

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
        if (this.isComponent) {
            const parentNode = this.getParentNode()
            const toRemove = [] // the Component's closest child nodes
            this.walkDepth((fiber) => {
                fiber.cleanup()
                if (!fiber.isComponent) {
                    const node = fiber.node
                    node.parentNode === parentNode && toRemove.push(node)
                }
            })
            for (let i=toRemove.length; i--; ) parentNode.removeChild(toRemove[i])
            return
        }
        this.walkDepth((fiber) => fiber.cleanup())
        removeNode && this.node.parentNode.removeChild(this.node)
    }

    /**
     * Calls (sync) or schedules (async) each effect's cleanup function.
     */
    cleanup() {
        if (this.isComponent) {
            for (const e of this.effects) e.cleanup && (e.sync
                ? e.cleanup()
                : queue.async.push(e.cleanup)
            )
            this.actual[0] = null
        } else if (this.props.ref) this.props.ref(null)
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
                // and don't go deeper if returned `null` or memoized
                if (parentFirst && parentFirst(fiber) === null || fiber.memo) {
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
        this.memo = false
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