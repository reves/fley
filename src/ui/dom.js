import { Text } from './Element'

/**
 * TODO: SVG elements
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

        // Unset Ref
        if (prop === 'ref') {
            prevProps[prop].current = null
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

        // Ref
        if (prop === 'ref') {
            nextProps[prop].current = node
            continue
        }

        // Event listener
        if (/^on.+/i.test(prop)) {
            node[prop.toLowerCase()] = nextProps[prop]
            continue
        }

        // Skip same values
        if (prevProps.hasOwnProperty(prop) && prevProps[prop] === nextProps[prop]) {
            continue
        }

        // Attribute
        if (prop === 'value') {
            node.value = nextProps[prop]
        } else if (typeof nextProps[prop] === 'boolean' && nextProps[prop]) {
            node.setAttribute(prop, '')
        } else if (nextProps[prop] != null) {
            node.setAttribute(prop, nextProps[prop])
        } else {
            node.removeAttribute(prop)
        }

    }

    return node
}

function isReserved(prop) {
    return prop === 'children' || prop === 'html'
}
