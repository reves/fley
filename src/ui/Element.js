import { isFunction, isObject } from "../utils"

/**
 * JSX Element types
 */
export const Fragment = 0
export const Text = 1
export const Inline = 2

/**
 * JSX Element
 */
export default function Element(type, props, key) {
    if ('children' in props) props.children = normalize(props.children)
    this.type = type
    this.props = props
    this.key = key
}

/**
 * Returns an Array of normalized children.
 */
export function normalize(children = [], result = [], keys = {}) {

    // Convert to array if not
    if (!Array.isArray(children)) children = [children]

    // Process children
    for (let i=0, n=children.length; i<n; i++) {

        const child = children[i]

        // Remove empty strings and unnecessary data types
        if (child === '' || child == null || child === false || child === true) {
            continue
        }

        // Execute functions
        if (isFunction(child)) {
            result.push(new Element(child, {}))
            continue
        }

        // Text Element
        if (!isObject(child)) {
            const prev = result[result.length-1]
            if (prev && prev.type === Text) {
                prev.props.value += child
                continue
            }
            result.push(new Element(Text, { value: '' + child }))
            continue
        }

        // Flatten array
        if (Array.isArray(child)) {
            normalize(child, result, keys)
            continue
        }

        // Inline HTML
        if (child.type === Inline) {
            const html = (child.props.html + '').trim()
            if (!html) continue
            if (html[0] !== '<') {
                result.push(new Element(Text, { value: html.split('<', 1)[0] }))
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