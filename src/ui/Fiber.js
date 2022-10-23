import { Text } from './Element'
import Hooks from "./Hooks"
import { queue, hydration } from "./renderer"
import { isBrowser } from '../utils'

export const isReserved = prop => (prop === 'children' || prop === 'html')
const isEventListener = prop => (prop[0] === 'o' && prop[1] === 'n')
export const TAG_SKIP   = 0
export const TAG_INSERT = 1

const textNode = isBrowser ? document.createTextNode('') : null
const elements = { div: isBrowser ? document.createElement('div') : null, }

export default class Fiber {

    constructor(element, node, parent, tag, replace) {
        this.type = element?.type
        this.isComponent = (typeof this.type === 'function')
        this.node = node
        this.props = element?.props
        this.parent = parent
        this.sibling = null
        this.child = null
        this.key = element?.key
        this.alt = null
        this.tag = tag
        this.replace = replace
        this.hooks = this.isComponent ? new Hooks(this) : null
    }

    clone(parent, pendingProps, tag, replace) {
        const fiber = new Fiber
        fiber.type = this.type
        fiber.isComponent = this.isComponent
        fiber.node = this.node
        fiber.props = pendingProps ?? this.props
        fiber.parent = parent ?? this.parent
        fiber.key = this.key
        fiber.alt = this
        fiber.tag = tag
        fiber.replace = replace?.isComponent ? null : replace
        fiber.hooks = this.hooks
        return fiber
    }

    reset() {
        this.alt = null
        this.tag = null
        this.replace = null
        this.props.children &&= null
    }

    /**
     * Applies changes to the DOM and manages side effects.
     */
    update(nodeCursor) {
        if (this.isComponent) {
            const hooks = this.hooks
            hooks.fiber = this
            for (const e of hooks.effects) {
                e && e.fn && (e.sync ? queue.sync.push(e.fn) : queue.async.push(e.fn))
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

        if (this.tag === TAG_INSERT) {
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
            this.node = textNode.cloneNode()
            this.node.nodeValue = this.props.value
            return
        }
        if ('html' in this.props) {
            const node = elements.div.cloneNode()
            node.innerHTML = this.type
            this.node = node.firstChild
        } else {
            const node = elements[this.type] ??= document.createElement(this.type)
            this.node = node.cloneNode()
        }
    }

    /**
     * Applies JSX props to the Fiber's node.
     */
    updateNode() {
        const node = this.node
        const nextProps = this.props

        if (this.type === Text) {
            if (hydration) return
            if (String(nextProps.value) !== node.nodeValue) {
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
            if ((prop in prevProps) && prevProps[prop] === value) {
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
            this.node.parentNode.removeChild(this.node)
            return
        }
        this.walkDepth(fiber => {
            if (!fiber.isComponent) return
            const hooks = this.hooks
            hooks.fiber = null
            for (const e of hooks.effects) e && e.cleanup && e.cleanup()
        })
        const childNodes = this.getChildNodes()
        for (const node of childNodes) node.parentNode.removeChild(node)
    }

    /**
     * Walks the subtree and applies the callback(s) to each fiber.
     */
    walkDepth(childFirst, parentFirst) {
        let fiber = this
        let goDeep = true
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

        while (true) {
            if (goDeep) {
                parentFirst && parentFirst(fiber)
                if (fiber.child) {
                    if (!fiber.isComponent) beforeChild()
                    fiber = fiber.child
                    continue
                }
            }
            childFirst(fiber, nodeCursor)
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

    /**
     * Returns the closest child nodes.
     */
    getChildNodes() {
        const nodes = []
        if (!this.child) return nodes
        let fiber = this.child
        while (true) {
            if (!fiber.isComponent) {
                nodes.push(fiber.node)
            } else if (fiber.child) {
                fiber = fiber.child
                continue
            }
            if (fiber.sibling) {
                fiber = fiber.sibling
                continue
            }
            while (true) {
                fiber = fiber.parent
                if (fiber === this) return nodes
                if (fiber.sibling) {
                    fiber = fiber.sibling
                    break
                }
            }
        }
    }
}