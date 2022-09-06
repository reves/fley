import { Text } from './Element'

/**
 * [TODO] SVG elements
 * 
 * Creates a DOM node.
 */
export function createNode(fiber) {
    if (fiber.node) return fiber.node
    if (fiber.type === Text) {
        fiber.node = document.createTextNode(fiber.props.value)
        return fiber.node
    }
    fiber.node = fiber.props.html ?? document.createElement(fiber.type)
    return updateNode(fiber)
}

/**
 * Applies JSX props to a DOM node.
 */
export function updateNode(fiber) {
    const node = fiber.node
    const nextProps = fiber.props

    if (fiber.type === Text) {
        if (String(nextProps.value) !== node.nodeValue) {
            node.nodeValue = nextProps.value
        }
        return node
    }

    const prevProps = fiber.alt?.props ?? {}

    // Obsolete props
    for (const prop in prevProps) {
        if (isReserved(prop)) continue
        const value = prevProps[prop]

        // Unset Ref
        if (prop === 'ref') {
            value.hasOwnProperty('current')
                ? value.current = null
                : value(null)
            continue
        }

        // Unset event listener
        if (/^on.+/i.test(prop)) {
            node[prop.toLowerCase()] = null
            continue
        }

        // Skip props that will remain
        if (nextProps.hasOwnProperty(prop)) continue

        // Remove attribute
        node.removeAttribute(prop)
    }

    // Updated props
    for (const prop in nextProps) {
        if (isReserved(prop)) continue
        const value = nextProps[prop]

        // Ref
        if (prop === 'ref') {
            value.hasOwnProperty('current')
                ? value.current = node
                : value(node)
            continue
        }

        // Event listener
        if (/^on.+/i.test(prop)) {
            node[prop.toLowerCase()] = value
            continue
        }

        // Skip same values
        if (prevProps.hasOwnProperty(prop) && prevProps[prop] === value) {
            continue
        }

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

    return node
}

function isReserved(prop) {
    return prop === 'children' || prop === 'html'
}
