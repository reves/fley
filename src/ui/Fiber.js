import Element, { Text, Inline } from './Element'
import { hydration, queue } from "./renderer"
import { isFunction, isBool, isValueRef, isPlaceholder } from '../utils'

const nodes = {} // nodes pool
export const isReserved = prop => prop === 'children' || prop === 'html' || prop === 'memo'
export const isEventListener = prop => prop[0] === 'o' && prop[1] === 'n'
export const createRoot = (children, node) =>
    new Fiber(new Element(null, { children }), node)

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
        this.sync = parent?.sync || false
        this.actual = [this] // ref to the latest cloned version

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
            this.statelessEffects = []
        } else {
            this.dynamicProps = {}
        }
    }

    clone(parent = this.parent, element, insert = false, toReplace) {
        // Memoization check
        let memoize = false
        if (arguments.length) {
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
        const fiber = new Fiber(element ?? this, this.node, parent, toReplace)
        fiber.sync = this.sync
        fiber.actual = this.actual

        // Reconciliation
        fiber.alt = this
        fiber.insert = insert
        fiber.memo = memoize

        // Component
        if (this.isComponent) {
            fiber.isComponent = true
            fiber.states = this.states
            fiber.effects = this.effects
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
        this.actual[0] = this // update version
        const memoized = this.memo

        if (this.type == null) {
            this.updateNode()
            return
        }

        // Update relations
        if (memoized) {
            let child = (this.child = this.alt.child)
            while (child) {
                child.parent = this
                child = child.sibling
            }
        }

        // Update Component
        if (this.isComponent) {
            if (memoized) {
                const onEach = this.insert && (f => f.insertNode(nodeCursor))
                setNodeCursor(this.getLastNode(onEach))
                return
            } 
            // Schedule effects
            for (const e of this.effects) e.fn && (e.sync
                ? queue.sync.push(e.fn)
                : queue.async.push(e.fn)
            )
            // Schedule statelsess effects
            if (this.alt) {
                for (const e of this.alt.statelessEffects)
                    e.cleanup && queue.sync.push(e.cleanup)
            }
            for (const e of this.statelessEffects) queue.syncR.push(e.fn)
            return
        }

        // Hydrate (bind the DOM node to the Fiber)
        if (hydration) {
            const parentNode = nodeCursor.parentNode

            // Placeholder
            if (nodeCursor.nodeType === 8) {
                const dataNode = nodeCursor.nextSibling
                parentNode.removeChild(nodeCursor)

                // Empty <!----><!---->
                if (dataNode.nodeType === 8) {
                    this.createNode()
                    parentNode.insertBefore(this.node, dataNode)
                    parentNode.removeChild(dataNode)
                    setNodeCursor(this.node)
                    return
                }

                // Parse <!---->data<!---->
                parentNode.removeChild(dataNode.nextSibling)
                this.parent.type(dataNode.nodeValue) // upd Value
                setNodeCursor(this.node = dataNode)
                return
            }

            // Regular node
            this.node = nodeCursor
            if (this.type === Text) {
                const len = this.props.value.length
                if (!len) {
                    // Text slot in an empty parent (recovered in walkDepth()).
                    if (!this.sibling && this.parent.child === this) return
                    // Recover text slot
                    this.createNode()
                    parentNode.insertBefore(this.node, nodeCursor)
                    setNodeCursor(this.node)
                } else if (len < nodeCursor.nodeValue.length) {
                    nodeCursor.splitText(len)
                }
            } else this.updateNode()
            return
        }

        // Insert or move the node, or replace an another node
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
        const prevProps = (this.type == null) ? {} : (this.alt?.props ?? {})

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

            // Value ref
            if (isFunction(value) && isValueRef(value)) {
                value._unwatch(this.actual)
                delete this.dynamicProps[prop]
            }

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

            // Function or Value (ref)
            if (isFunction(value)) {
                if (isValueRef(value)) {
                    if (!hydration) {
                        this.updateNodeAttribute(prop, value())
                    } else if (isPlaceholder(value)) {
                        value(node.getAttribute(prop))
                    }
                    value._watch(this.actual)
                    this.dynamicProps[prop] = value
                }
                continue
            }

            // Skip same values
            if (prop !== 'value' && prop in prevProps && Object.is(value, prevProps[prop])) {
                continue
            }
            
            if (hydration) continue

            // Attribute
            this.updateNodeAttribute(prop, value)
        }
    }

    updateNodeAttribute(prop, value) {
        const node = this.node
        if (prop === 'value') {
            node.value = value
        } else if (isBool(value) && value) {
            node.setAttribute(prop, '')
        } else if (value != null && !isBool(value)) {
            node.setAttribute(prop, value)
        } else {
            node.removeAttribute(prop)
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
            for (const e of this.statelessEffects) e.cleanup && e.cleanup()
        } else {
            if (this.props.ref) this.props.ref(null)
            const dyProps = this.dynamicProps
            for (const prop in dyProps) dyProps[prop]._unwatch(this.actual)
        }
        this.actual[0] = null
    }

    /**
     * Walks the Fiber and its subtree and applies the callback(s) to each fiber.
     */
    walkDepth(childFirst, parentFirst) {
        let fiber = this
        let goDeep = true

        // Node cursor
        let nodeCursor = hydration ? this.node : null
        const setNodeCursor = (node) => (nodeCursor = node)
        const nodeStack = []
        const beforeChild = hydration
            ? () => {
                let firstChild = nodeCursor.firstChild
                if (!firstChild) {
                    // Recover text slot in an empty parent
                    firstChild = document.createTextNode('')
                    nodeCursor.appendChild(firstChild)
                }
                setNodeCursor(firstChild)
            }
            : () => nodeStack.push(nodeCursor) && (nodeCursor = null)
        const beforeSibling = hydration
            ? () => {
                let nextSibling = nodeCursor.nextSibling
                if (!nextSibling) {
                    // Recover text slot for an empty sibling (very last child)
                    nextSibling = document.createTextNode('')
                    nodeCursor.parentNode.insertBefore(nextSibling, null)
                }
                setNodeCursor(nextSibling)
            }
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
