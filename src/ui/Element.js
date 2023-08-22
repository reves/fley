import { isArray, isBool, isFunction, isObject } from "../utils"

/**
 * JSX Element types
 */
export const Fragment = 0
export const Text = 1
export const Inline = 2

/**
 * JSX Element
 */
export default function Element(type, props = {}, key) {
    if ('children' in props) props.children = normalize(props.children)
    this.type = type
    this.props = props
    this.key = key
}

export const createTextElement = (value = '') => new Element(Text, { value })

/**
 * Returns an Array of normalized children.
 */
export function normalize(children = [], result = [], keys = {}) {

    // Convert to array if not
    if (!isArray(children)) children = [children]

    // Process children
    for (let i=0, n=children.length; i<n; i++) {

        const child = children[i]

        // Convert unnecessary data types to empty slots
        if (child == null || isBool(child)) {
            result.push(createTextElement())
            continue
        }

        // Convert function to Component
        if (isFunction(child)) {
            result.push(new Element(child))
            continue
        }

        // Text Element
        if (!isObject(child)) {
            const prev = result[result.length-1]
            if (prev && prev.type === Text) {
                prev.props.value += child
                continue
            }
            result.push(createTextElement('' + child))
            continue
        }

        // Flatten array
        if (isArray(child)) {
            normalize(child, result, keys)
            continue
        }

        // Inline HTML
        if (child.type === Inline) {
            const html = (child.props.html + '').trim()
            if (!html) continue
            if (html[0] !== '<') {
                result.push(createTextElement(html.split('<', 1)[0]))
                continue
            }
            child.props.html = html
        }

        // Filter duplicate keys
        if (child.key != null) {
            if (child.key in keys) continue
            keys[child.key] = null
        }

        result.push(child)
    }
 
    return result
}