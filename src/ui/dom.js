import { Text, Inline } from './Element'

/**
 * [TODO: SVG elements]
 * 
 * Creates a DOM node.
 */
export function createNode(fiber) {
    if (fiber.node) return fiber.node

    switch (true) {
        case fiber.type === Text:
            fiber.node = document.createTextNode(fiber.props.value)
            return fiber.node

        case fiber.type === Inline:
            fiber.node = document.createElement('div')
            fiber.node.innerHTML = fiber.props.html ?? ''
            fiber.node = fiber.node.childNodes[0] ?? document.createTextNode('');
            break

        default:
            fiber.node = document.createElement(fiber.type)
    }

    return fiber.node = updateNode(fiber)
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
    const reserved = (prop) => prop === 'children' || prop === 'html'

    // Obsolete props
    for (const prop in prevProps) {
        if (reserved(prop)) continue

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
        if (reserved(prop)) continue

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
