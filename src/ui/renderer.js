import Fiber from './Fiber'
import { normalize, Text, Inline } from './Element'
import { resetCursors } from './hooks'
import { isBrowser } from '../utils'

// Is commit stage.
let isCommit = false

// Current level of a synchronous subtree. Defaults to 0, but initialized with 
// a surplus so that the root is considered a "synchronous subtree". Thus, the 
// first render is synchronous.
let synchronous = 1

// Is hydration process.
export let hydration = false

// The Fiber that is being updated.
let root = null

// Next fiber to be rendered.
let next = null

// The Component that is being rendered (hooks context).
export let current = null

// Scheduling
let idleCallbackId = null
export const queue = {
    deletions:  [], // fibers to be unmounted
    update:     [], // fibers to be updated
    reset:      [], // functions to be called in reset()
    sync:       [], // effects to be performed sync. during commit
    async:      [], // effects to be performed async. after commit
    timeoutId:  null
}

/**
 * Initiates the rendering process of the fiber subtree.
 */
export function update(fiber, hydrate = false) {
    if (!fiber) return // unmounted

    // Another rendering process is already running
    if (root) {
        if (!isCommit) {
            const rootAlt = root.alt
            let rootParent = rootAlt
            let fiberParent = fiber.parent

            while (rootParent || fiberParent) {
                // Fiber is the ancestor of root, or the root itself
                if (rootParent === fiber) {
                    reset(true)
                    update(fiber)
                    return
                }
                // Fiber is a descendant of root
                if (fiberParent === rootAlt) {
                    reset(true)
                    update(rootAlt)
                    return
                }
                rootParent = rootParent?.parent
                fiberParent = fiberParent?.parent
            }
        }
        // Fiber is on another branch
        queue.update.push([fiber.actual, hydrate])
        return
    }

    // Run the rendering process
    hydration = hydrate
    root = fiber.clone()
    next = root
    if (root.sync) synchronous++
    if (synchronous) return render()
    idleCallbackId = requestIdleCallback(render)
}

/**
 * Cancels the rendering process and resets the data.
 */ 
function reset(saveUpdateQueue = false) {
    // Renderer
    isCommit = false
    synchronous = 0
    hydration = false
    root = null
    next = null
    if (idleCallbackId != null) {
        cancelIdleCallback(idleCallbackId)
        idleCallbackId = null
    }

    // Queue
    for (const fn of queue.reset) fn()
    queue.deletions.length = 0
    if (!saveUpdateQueue) queue.update.length = 0
    queue.reset.length = 0
    queue.sync.length = 0
}

/**
 * Renders the fiber tree.
 */
function render(deadline) {
    while (synchronous || deadline.timeRemaining() > 0) {
        next = reconcile(next)
        if (!next) return commit()
    }
    idleCallbackId = requestIdleCallback(render)
}

/**
 * Renders the fiber and initiates the reconciliation process for child fibers. 
 * Returns the next fiber to render.
 */
function reconcile(fiber) {
    const type = fiber.type

    if (!fiber.memo) {
        if (fiber.isComponent) {
            current = fiber
            reconcileChildren(fiber, normalize(type(fiber.props)), fiber.insert)
            current = null
            resetCursors()
        } else {
            if (!fiber.node && isBrowser && !hydration) fiber.createNode()
            if (type !== Text && type !== Inline) {
                reconcileChildren(fiber, fiber.props.children)
            }
        }
    }

    if (fiber.sync) synchronous++
    if (fiber.child && !fiber.memo) return fiber.child
    while (fiber) {
        if (fiber.sync) synchronous--
        if (fiber === root) return null
        if (fiber.sibling) return fiber.sibling
        fiber = fiber.parent
    }
}

/**
 * Compares the existing child fibers to the new JSX elements and decides which 
 * changes to apply.
 */
function reconcileChildren(parent, elements = [], parentInsert = false) {
    const elementsLen = elements.length
    let i = 0
    let alt = parent.alt?.child
    let prev = null
    let fiber = null

    const relate = (lookaheadElement = false) => {
        if (!lookaheadElement && alt) alt = alt.sibling
        if (i === 0) { parent.child = fiber } else { prev.sibling = fiber }
        prev = fiber
        prev.sibling = null
        i++
    }
    const scheduleDeletion = (removeNode = false) =>
        queue.deletions.push([alt, removeNode])

    while (true) {
        const element = elements[i]

        // Looked-ahead element
        if (element?.rel) {
            fiber = element.rel.clone(parent, element, true)
            element.rel = null
            relate(true)
            continue
        }

        if (alt) {

            // Looked-ahead alternate
            if (alt.skip) {
                alt.skip = false
                alt = alt.sibling
                continue
            }

            // Both exist
            if (element) {

                if (alt.key != null) {

                    // Both keyed
                    if (element.key != null) {

                        // Equal keys
                        if (alt.key === element.key) {
                            fiber = alt.clone(parent, element, parentInsert)
                            relate()
                            continue
                        }

                        // Different keys

                        const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)
                        const elementWithSameKeyAsAlt = getElementByKey(elements, elementsLen, i+1, alt.key)

                        // Found an alternate with the same key as element
                        if (altWithSameKeyAsElement) {

                            fiber = altWithSameKeyAsElement.clone(parent, element, true, alt)
                            altWithSameKeyAsElement.skip = true

                            // Found an element with the same key as alternate
                            if (elementWithSameKeyAsAlt) {
                                elementWithSameKeyAsAlt.rel = alt
                                relate()
                                continue
                            }

                            // Not found element with the same key as alternate
                            scheduleDeletion()
                            relate()
                            continue
                        }

                        // Not found an alternate with the same key as element

                        fiber = new Fiber(element, null, parent, alt)

                        // Found an element with the same key as alternate
                        if (elementWithSameKeyAsAlt) {
                            elementWithSameKeyAsAlt.rel = alt
                            relate()
                            continue
                        }

                        // Not found element with the same key as alternate
                        scheduleDeletion()
                        relate()
                        continue
                    }

                    // Keyed alternate and non-keyed element

                    const elementWithSameKeyAsAlt = getElementByKey(elements, elementsLen, i+1, alt.key)
                    fiber = new Fiber(element, null, parent, alt)

                    // Found an element with the same key as alternate
                    if (elementWithSameKeyAsAlt) {
                        elementWithSameKeyAsAlt.rel = alt
                        relate()
                        continue
                    }

                    // Not found an element with the same key as alternate
                    scheduleDeletion()
                    relate()
                    continue
                }

                // Keyed element and non-keyed alternate
                if (element.key != null) {

                    const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)
                    scheduleDeletion()

                    // Found an alternate with the same key as element
                    if (altWithSameKeyAsElement) {
                        fiber = altWithSameKeyAsElement.clone(parent, element, true, alt)
                        altWithSameKeyAsElement.skip = true
                        relate()
                        continue
                    }

                    // Not found an alternate with the same key as element
                    fiber = new Fiber(element, null, parent, alt)
                    relate()
                    continue
                }

                // Both non-keyed

                // Same type
                if (alt.type === element.type) {
                    fiber = alt.clone(parent, element, parentInsert)
                    relate()
                    continue
                }

                // Different type
                fiber = new Fiber(element, null, parent, alt)
                scheduleDeletion(fiber.isComponent)
                relate()
                continue
            }

            // Alternate exists but element does not
            scheduleDeletion(true)
            alt = alt.sibling
            continue
        }

        // Element exists but alternate does not
        if (element) {
            fiber = new Fiber(element, null, parent)
            relate()
            continue
        }

        break
    }
}

function getSiblingByKey(fiber, key) {
    fiber = fiber.sibling
    while (fiber && fiber.key !== key) fiber = fiber.sibling
    return fiber
}

function getElementByKey(elements, elementsLen, startIndex, key) {
    for (let i=elementsLen-1; i>=startIndex; i--) {
        if (elements[i].key === key) return elements[i]
    }
    return null
}

/**
 * Applies changes.
 */
function commit() {
    if (!isBrowser) return [root, reset]
    isCommit = true

    // Replace the alternate in the tree with its clone
    const parent = root.parent
    if (parent) {
        const alt = root.alt
        root.sibling = alt.sibling
        if (parent.child === alt) {
            parent.child = root
        } else {
            let prev = parent.child
            while (prev.sibling !== alt) prev = prev.sibling
            prev.sibling = root
        }
    }

    // Call sync cleanups
    const sync = queue.sync
    for (let i=sync.length; i--; ) sync[i]()
    sync.length = 0

    // Deletetions
    const deletions = queue.deletions
    for (let i=deletions.length; i--; ) {
        const [fiber, removeNode] = deletions[i]
        fiber.unmount(removeNode)
    }

    // Update DOM
    root.walkDepth((fiber, nodeCursor, setNodeCursor) => {
        fiber.update(nodeCursor, setNodeCursor)
        fiber.reset()
    })

    // Produce sync effects queued in the "Update DOM" step
    for (const effect of sync) effect()

    // Schedule async effects
    if (queue.timeoutId == null) scheduleNextEffect()

    // Process the update queue
    if (queue.update.length) {
        const updates = queue.update.slice()
        reset()
        for (let i=0; i<updates.length; i++) {
            synchronous = 1
            const [actual, hydrate] = updates[i]
            update(actual[0], hydrate) // update "actual"
        }
        return
    }
    // Done
    reset()
}

function scheduleNextEffect() {
    queue.timeoutId = queue.async.length
        ? setTimeout(() => {
            queue.async.shift()()
            scheduleNextEffect()
        }) : null
}
