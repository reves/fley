/**
 * JSX element types
 */
export const Fragment = 'FRAGMENT'
export const Inline = 'INLINE'
export const Text = 'TEXT'

/**
 * JSX element
 */
export default function Element(type, props, key) {
    if (props.hasOwnProperty('children')) {
        props.children = normalize(props.children)
    }
    this.type = type
    this.props = props
    this.key = key?.toString()
}

/**
 * Returns an Array of normalized children.
 */
export function normalize(children = [], result = [], keys = {}) {

    children = Array.isArray(children) ? children : [children]

    // Process children
    for (let i=0, n=children.length; i<n; i++) {

        const child = children[i]

        // Remove unnecessary data types
        if (child == null || child === false || child === true) {
            continue
        }

        // Execute functions
        if (typeof child === 'function') {
            normalize(child(), result, keys)
            continue
        }

        // Text Element
        if (typeof child !== 'object') {
            result.push(new Element(Text, {value: child}))
            continue
        }

        // Flatten array
        if (Array.isArray(child)) {
            normalize(child, result, keys)
            continue
        }

        // Inline HTML
        if (child.type === Inline) {
            let node = document.createElement('div')
            node.innerHTML = child.props.html ?? ''
            node = node.childNodes[0] ?? document.createTextNode('')
            if (node.nodeName === '#text') {
                result.push(new Element(Text, {value: node.nodeValue}))
                continue
            }
            child.type = Symbol(Inline)
            child.props.html = node
        }

        // Filter Elements that have duplicate keys
        if (child.key != null) {
            if (child.key in keys) continue
            keys[child.key] = null
        }

        result.push(child)
    }
 
    return result
}
