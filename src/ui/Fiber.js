import { statesWatchers } from '../State'
import { queue } from './renderer'

export const tag = {
    UPDATE: 'UPDATE',
    INSERT: 'INSERT',
    MOVE:   'MOVE',
    SAVE:   'SAVE', // just fiber.tag == null ?
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
        this.next = null
        this.child = null
        this.parent = null
        this.sibling = null
        this.states = []
        this.hookIndex = 0
        this.watching = []
        this.inQueue = false
        this.onUpdate = null
        this.effects = []
        this.effectsDependencies = []
        this.effectsCleanups = []

        // Reconcile
        this.skip = false

        // Commit
        this.tag = null
        this.relFiber = null
    }

    clone(parent, pendingProps)
    {
        const fiber = new Fiber
        this.alternate = null
        this.next = fiber
        fiber.alternate = this
        fiber.isComponent = this.isComponent
        fiber.node = this.node
        fiber.type = this.type
        fiber.props = pendingProps || this.props
        fiber.key = this.key
        fiber.parent = parent || this.parent
        fiber.states = this.states
        fiber.watching = this.watching
        fiber.onUpdate = this.onUpdate
        fiber.effects = this.effects

        fiber.watching.forEach(globalState => {
            const watchers = statesWatchers.get(globalState)
            const index = watchers.indexOf(this)
            if (index === -1) {
                console.log('-1 !!! ', fiber.type.name) // debug
                return
            }
            watchers[index] = fiber
        })

        if (this.inQueue) {
            // console.log('inQUeue') // debug
            const index = queue.indexOf(this)
            if (index !== -1) queue[queue.indexOf(this)] = fiber
        }

        return fiber
    }

    cloneTree(parent)
    {
        const fiber = this.clone(parent)

        fiber.skipReconcile = true
        fiber.child = this.child.clone(fiber)

        // Clone subtree
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
