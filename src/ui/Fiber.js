import { Text, Inline } from './Element'
import { hydration, queue } from "./renderer"

const nodes = {} // nodes pool
export const isReserved = prop => prop === 'children' || prop === 'html' || prop === 'memo' // TODO: "memo"?
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
        this.toReplace = toReplace?.isComponent ? null : toReplace // TODO: replace components also
        this.reuse = false
        this.rel = null

        // Component
        if (typeof this.type === 'function') {
            this.isComponent = true
            this.states = []
            this.effects = []
        }
    }

    clone(parent, nextProps, insert = false, toReplace) { // TOOD: insert <-- toReplace (store in insert ?)

        // Reuse (if not root)
        let reuse = false
        if (parent) {
            // TODO: HERE decide whether to reuse or not

            if (this.type === Text && this.props.value === nextProps.value) reuse = true
            else if (this.props.memo && nextProps.memo) reuse = true

        }

        if (this.reuse = reuse) {
            queue.reuses.push([this, this.parent])
            this.parent = parent
            this.insert = insert
            this.toReplace = toReplace?.isComponent ? null : toReplace
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
        fiber.toReplace = toReplace?.isComponent ? null : toReplace // TODO: replace components also

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
        this.rel = null
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
     * Applies changes to the DOM and manages side effects.
     */
    update(nodeCursor) {
        // console.log('UPDATE: ', this.isComponent ? this.type.name : this.type, this.props.value || '', nodeCursor) // DEBUG
        console.log('UPDATE: ', this.isComponent ? this.type.name : this.type, this.node || '') // DEBUG

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

        // Insert, Move or Replace a node
        if (this.insert) this.insertNode(nodeCursor)

        // Update attributes or node value
        if (this.type === Text) {
            this.node.nodeValue = this.props.value
            return
        }
        this.updateNode()
    }

    /**
     * Inserts or Moves Fiber's node, or Replaces an another node with Fiber's.
     */
    insertNode(nodeCursor) {
        const parentNode = this.getParentNode()
        const toReplace = this.toReplace
        if (toReplace) {
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
    unmount() {
        if (!this.isComponent) {
            this.walkDepth((fiber) => fiber.isComponent && fiber.cleanup())
            this.node.parentNode.removeChild(this.node)
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
     * Calls (or schedules) each effect's cleanup function.
     */
    cleanup() {
        for (const e of this.effects) e?.cleanup && (e.sync
            ? e.cleanup()
            : queue.async.push(e.cleanup)
        )
        this.effects.length = 0
    }

    /**
     * Walks the subtree and applies the callback(s) to each fiber.
     */
    walkDepth(childFirst, parentFirst) {
        let fiber = this
        let goDeep = true
        let skip = false

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
                // Reuse (skip Fiber and its subtree)
                if (fiber.reuse) {
                    if (fiber.isComponent) {
                        const onEach = fiber.insert && (f => f.insert())
                        nodeCursor = fiber.getLastNode(onEach) ?? nodeCursor
                    } else if (fiber.insert) fiber.insertNode()
                    fiber.reset()
                    skip = true
                }

                // Perform parentFirst()
                if (skip || parentFirst && parentFirst(fiber) === null) {
                    goDeep = false // skip subtree if parentFirst() returned `false`
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
            !skip && childFirst && childFirst(fiber, nodeCursor)
            skip = false

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
        let node = null
        this.reuse = false
        this.walkDepth(null, (fiber) => {
            if (fiber !== this && !f.isComponent) {
                onEach && onEach(fiber)
                node = fiber.node
                return null
            }
        })
        return node
    }
}