export const tag = {
    INSERT: 1,
    UPDATE: 2,
    SKIP:   3,
}

export default function Fiber(element, node, parent, tag, relation) {
    this.type = element?.type
    this.isComponent = (typeof this.type === 'function')
    this.node = node
    this.props = element?.props
    this.parent = parent
    this.sibling = null
    this.child = null
    this.key = element?.key
    this.alt = null
    this.tag = tag
    this.relation = relation
    this.hooks = this.isComponent ? new Hooks : null
}

export function clone(alt, parent, pendingProps, tag, relation) {
    const fiber = new Fiber
    fiber.type = alt.type
    fiber.isComponent = alt.isComponent
    fiber.node = alt.node
    fiber.props = pendingProps ?? alt.props
    fiber.parent = parent ?? alt.parent
    fiber.key = alt.key
    fiber.alt = alt
    fiber.tag = tag
    fiber.relation = relation
    if (fiber.isComponent) {
        fiber.hooks = new Hooks
        fiber.hooks.states = alt.hooks.states
        fiber.hooks.stores = alt.hooks.stores
        fiber.hooks.ref = alt.hooks.ref
    }
    return fiber
}

function Hooks() {
    this.effects = []
    this.layoutEffects = []
    this.states = []
    this.stores = []
    this.ref = []
}

export function clean(fiber) {
    fiber.alt = null
    fiber.tag = null
    fiber.relation = null
}
