export const Fragment = 'FRAGMENT'
export const Inline = 'INLINE'
export const Text = 'TEXT'

export default class Element
{
    constructor(type, props, key)
    {
        if (props.hasOwnProperty('children')) {
            props.children = normalize(props.children)
        }

        this.type = type
        this.props = props
        this.key = key?.toString() ?? key

        // Reconcile-specific reference
        this.alternateWithSameKey = null
    }

}

/**
 * Returns an array of normalized children.
 */
export function normalize(children) {

    const keys = []
    const result = []

    // Flatten nested arrays
    children = Array.isArray(children) ? [].concat(...children) : [children]

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
        if (child.key != null && !keys.includes(child.key)) {
            keys.push(child.key)
            result.push(child)
            continue
        }

        result.push(child)
    }

    return result
}
