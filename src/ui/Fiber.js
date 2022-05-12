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
    this.hooks = this.isComponent ? new Hooks(this) : null
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
    fiber.hooks = alt.hooks
    return fiber
}

function Hooks(fiber) {
    this.effects = []
    this.states = []
    this.stores = []
    this.refs = []
    this.fiber = fiber
}

export function clean(fiber) {
    fiber.alt = null
    fiber.tag = null
    fiber.relation = null
}
