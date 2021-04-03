import Component from './types/Component'
import Inline from './types/Inline'
import Value from './types/Value'

// https://developer.mozilla.org/en-US/docs/Glossary/Empty_element
const emptyElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']

/**
 * Recursively normalizes the container's subtree:
 * - flattens Arrays and Components;
 * - executes functions;
 * - converts primitives and trivial data types to Value containers:
 *   1. undefined || null || empty array => empty string
 *   2. primitive => actual value
 */
export default function normalize(data, parentContainer) {

    // Convert trivial types
    if (data == null) return [new Value]

    // Execute functions
    if (typeof data === 'function') return normalize(data(), parentContainer)

    // Convert primitives
    if (typeof data !== 'object') return [new Value(data)]

    // Flatten arrays
    if (data instanceof Array) {
        if (!data.length) return [new Value]
        return data.reduce((flat, val) => flat.concat(normalize(val, parentContainer)), [])
    }

    // Convert object to Inline container
    if (data.inline != null) return [new Inline(data.inline)]

    // Normalize container subtree
    if (!parentContainer) {
        if (!Array.isArray(data.children)) data.children = [].concat(data.children)
        if (emptyElements.indexOf(data.type) === -1) data.children = normalize(data.children, data)
        return data
    }

    // Flatten Components
    if (data instanceof Component) {
        return data.children
    }

    // Filter Elements that have duplicate keys
    if (data.key != null) {
        if (parentContainer.childKeys.indexOf(data.key) !== -1) return []
        parentContainer.childKeys.push(data.key)
    }

    // Return the Element
    return [data]
}
