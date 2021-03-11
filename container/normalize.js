import Component from './types/Component'
import Element from './types/Element'
import Value from './types/Value'

/**
 * Recursively executes functions and flattens arrays.
 * 
 * Text nodes for values:
 * 1. undefined => empty string
 * 2. null => empty string
 * 3. empty array (instanceof Array and !arr.length) => empty string
 * 4. typeof container != 'object' => Value container
 */
export default function normalize(data, parentContainer) {

    // Trivial data
    if (data == null) return [new Value]

    // Function generated data (anonymous component)
    if (typeof data === 'function') {
        if (parentContainer instanceof Component) return normalize(data(), parentContainer)
        if (parentContainer instanceof Element) parentContainer.dynamic = true
        const container = new Component(data)
        if (!container.component.length) container.component = [new Value]
        return [container]
    }

    // Primitive data
    if (typeof data !== 'object') return [new Value(data)]

    // Array data
    if (data instanceof Array) {
        if (!data.length) return [new Value]
        const flat = []
        data.forEach(items => normalize(items, parentContainer).forEach(item => flat.push(item)))
        return flat
    }

    // 
    // Element or Component:
    // 

    // Normalize container
    if (!parentContainer) {
        if (data instanceof Element) data.children = normalize(data.children, data)
        else data.component = normalize(data.component, data)
        return data
    }

    // Set parent container dynamic or flatten a Component
    if (parentContainer instanceof Element) {
        if(data.dynamic || data instanceof Component) parentContainer.dynamic = true
    } else if (data instanceof Component) return data.component

    // Filter duplicate keys
    if (data.key != null) {
        if (parentContainer.childKeys.indexOf(data.key) !== -1) return []
        parentContainer.childKeys.push(data.key)
    }

    return [data]
}
