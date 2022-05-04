/**
 * Symbols for JSX element types
 */
export const Fragment = 'FRAGMENT'
export const Inline = 'INLINE'
export const Text = 'TEXT'

/**
 * Creates a JSX element.
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
export function normalize(children) {

    const keys = []
    const result = []

    // Flatten nested arrays
    children = Array.isArray(children) ? [].concat(...children) : [children]

    // Process children
    for (let i=0, n=children.length; i<n; i++) {

        const child = children[i]

        // Remove unnecessary data types
        if (child == null || child === false || child === true) {
            continue
        }

        // Execute functions
        if (typeof child === 'function') {
            result.push(...normalize(child()))
            continue
        }

        // Text Element
        if (typeof child !== 'object') {
            result.push(new Element(Text, {value: child}))
            continue
        }

        // Filter Elements that have duplicate keys
        if (child.key != null) {
            if (~keys.indexOf(child.key)) continue
            keys.push(child.key)
        }

        result.push(child)
    }

    return result
}
