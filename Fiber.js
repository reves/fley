import { Root } from './Element'
import { statesWatchers } from './State'

export const tag = {
    UPDATE: 'UPDATE',
    INSERT: 'INSERT',
    MOVE:   'MOVE',
    SAVE:   'SAVE', // just fiber.tag = null ?
}

export default class Fiber
{
    constructor()
    {
        this.isComponent = false
        this.node = null
        this.type = null
        this.props = null
        this.key = null
        this.alternate = null
        this.child = null
        this.parent = null
        this.sibling = null

        this.update = null
        this.states = []
        this.stateIndex = 0

        this.watching = []

        this.cloned = null

        // Reconcile
        this.skip = false

        // Commit
        this.tag = null
        this.relFiber = null
    }

    clone(parent, pendingProps)
    {
        const fiber = new Fiber
        fiber.alternate = this
        fiber.isComponent = this.isComponent
        fiber.node = this.node
        fiber.type = this.type
        fiber.props = pendingProps || this.props
        fiber.key = this.key
        fiber.parent = parent || this.parent

        fiber.states = this.states
        fiber.watching = this.watching

        this.watching.forEach(globalState => {
            const watchers = statesWatchers.get(globalState)
            const index = watchers.indexOf(this)
            watchers[index] = fiber
        })

        return fiber
    }

    cloneTree(parent)
    {
        const fiber = new Fiber
        fiber.skipReconcile = true
        fiber.alternate = this
        fiber.isComponent = this.isComponent
        fiber.node = this.node
        fiber.type = this.type
        fiber.props = this.props
        fiber.key = this.key
        fiber.parent = parent
        fiber.child = this.child.clone(fiber)

        fiber.states = this.states
        fiber.watching = this.watching

        this.watching.forEach(globalState => {
            const watchers = statesWatchers.get(globalState)
            const index = watchers.indexOf(this)
            watchers[index] = fiber
        })

        let alternate = this.child
        let current = fiber.child

        while (true) {

            if (alternate.child) {
                current.child = alternate.child.clone(current)
                alternate = alternate.child
                current = current.child
                continue
            }

            if (alternate.sibling) {
                current.sibling = alternate.sibling.clone(current.parent)
                alternate = alternate.sibling
                current = current.sibling
                continue
            }

            while (alternate.parent !== this && !alternate.parent.sibling) {
                alternate = alternate.parent
                current = current.parent
            }

            if (alternate.parent === this) break

            if (alternate.parent.sibling) {
                current.parent.sibling = alternate.parent.sibling.clone(current.parent.parent)
                alternate = alternate.parent.sibling
                current = current.parent.sibling
                continue
            }

            break

        }

        return fiber
    }

    static createHostRoot(rootNode, children)
    {
        const fiber = new Fiber
        fiber.type = Root
        fiber.node = rootNode
        fiber.props = { children }
        return fiber
    }

    static from(element, parentFiber)
    {
        const fiber = new Fiber
        fiber.isComponent = typeof element.type === 'function'
        fiber.type = element.type
        fiber.props = element.props
        fiber.key = element.key
        fiber.parent = parentFiber
        return fiber
    }

}
