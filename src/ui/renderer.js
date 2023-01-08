import Fiber from './Fiber'
import { normalize, Text, Inline } from './Element'
import { resetCursor } from './hooks'
import { isBrowser } from '../utils'

// Is the current rendering process concurrent.
// Defaults to `false` so the first rendering process is syncronous.
let concurrent = false

// Blocks concurrency.
let syncOnly = false
export const setSyncOnly = _ => syncOnly = true

// Is hydration process.
export let hydration = false

// The Fiber that is being updated.
let root = null

// Next fiber to be rendered.
let next = null

// The Fiber that is being rendered (hooks context).
export let current = null

// Scheduling
let idleCallbackId = null
export const queue = {
    deletions:  [], // fibers to be unmounted
    reuses:     [], // fibers to be reused
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
    // Unmounted
    if (fiber.type && !fiber.actual) return

    // Another rendering process is already running
    if (root) {
        const rootAlt = root.alt
        let rootParent = rootAlt
        let fiberParent = fiber.parent

        while (rootParent || fiberParent) {
            // Fiber is the ancestor of root, or the root itself
            if (rootParent === fiber) {
                reset()
                update(fiber)
                return
            }
            // Fiber is a descendant of root
            if (fiberParent === rootAlt) {
                reset()
                update(rootAlt)
                return
            }
            rootParent = rootParent?.parent
            fiberParent = fiberParent?.parent
        }
        // Fiber is on another branch
        queue.update.push(fiber)
        return
    }

    // Run the rendering process
    hydration = hydrate
    root = fiber.clone()
    next = root
    if (!concurrent) return render()
    idleCallbackId = requestIdleCallback(render)
}

/**
 * Cancels the rendering process and resets the data.
 */
function reset() {
    // Renderer
    if (!syncOnly) concurrent = true
    hydration = false
    root = null
    next = null
    current = null
    if (idleCallbackId != null) {
        cancelIdleCallback(idleCallbackId)
        idleCallbackId = null
    }

    // Queue
    for (const fn of queue.reset) fn()
    for (const [fiber, parent, sibling] of queue.reuses) {
        fiber.parent = parent
        fiber.sibling = sibling
        fiber.reset()
    }
    queue.deletions.length = 0
    queue.reuses.length = 0
    queue.update.length = 0
    queue.reset.length = 0
    queue.sync.length = 0
}

/**
 * Renders the fiber tree.
 */
function render(deadline) {
    // Main loop (sync)
    if (!concurrent) {
        while (next) next = reconcile(current = next)
        return commit()
    }

    // Timed loop (concurrent)
    while (deadline.timeRemaining() > 0 && next) next = reconcile(current = next)
    if (!next) return commit()
    idleCallbackId = requestIdleCallback(render)
}

/**
 * Renders the fiber and initiates the reconciliation process for child fibers. 
 * Returns the next fiber to render.
 */
function reconcile(fiber) {
    const type = fiber.type

    if (!fiber.reuse) {
        if (fiber.isComponent) {
            resetCursor()
            reconcileChildren(fiber, normalize(type(fiber.props)), fiber.insert)
        } else {
            if (!fiber.node && isBrowser && !hydration) fiber.createNode()
            if (type !== Text && type !== Inline) {
                reconcileChildren(fiber, fiber.props.children)
            }
        }
    }

    if (fiber.child && !fiber.reuse) return fiber.child
    while (fiber) {
        if (fiber.sibling) return fiber.sibling
        if (fiber.parent === root) return null
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
    const scheduleDeletion = (obsolete) => // delete if not suitable for node replacement
        (obsolete || alt.isComponent || fiber.isComponent) && queue.deletions.push(alt)

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
            if (alt.rel) {
                const nextAlt = alt.rel === true
                    ? alt.sibling   // bool:  continue with the sibling
                    : alt.rel       // Fiber: continue with the original sibling
                alt.rel = null
                alt = nextAlt
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
                            // remember the original sibling if reusing
                            altWithSameKeyAsElement.rel = fiber.reuse ? fiber.sibling : true

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

                    // Found an element with the same key as alternate
                    if (elementWithSameKeyAsAlt) {
                        fiber = new Fiber(element, null, parent)
                        elementWithSameKeyAsAlt.rel = alt
                        relate()
                        continue
                    }

                    // Not found an element with the same key as alternate
                    fiber = new Fiber(element, null, parent, alt)
                    scheduleDeletion()
                    relate()
                    continue
                }

                // Keyed element and non-keyed alternate
                if (element.key != null) {

                    const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)

                    // Found an alternate with the same key as element
                    if (altWithSameKeyAsElement) {
                        fiber = altWithSameKeyAsElement.clone(parent, element, true, alt)
                        altWithSameKeyAsElement.rel = fiber.reuse ? fiber.sibling : true
                        scheduleDeletion()
                        relate()
                        continue
                    }

                    // Not found an alternate with the same key as element
                    fiber = new Fiber(element, null, parent, alt)
                    scheduleDeletion()
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
                scheduleDeletion()
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
    queue.reuses.length = 0

    // Force sync execution of remaining async effects from previous commit
    const async = queue.async
    if (async.length) { 
        clearTimeout(queue.timeoutId)
        for (const effect of async) effect()
        async.length = 0
    }

    // Relace the alternate from the main tree with the updated fiber
    if (root.parent) {
        const alt = root.alt
        const altParent = alt.parent
        root.sibling = alt.sibling
        if (altParent.child === alt) {
            altParent.child = root
        } else {
            let prev = altParent.child
            while (prev.sibling !== alt) prev = prev.sibling
            prev.sibling = root
        }
    }

    // Call sync cleanups
    const sync = queue.sync
    for (let i=sync.length-1; i>=0; i--) sync[i]()
    sync.length = 0

    // Deletetions
    for (const fiber of queue.deletions) fiber.unmount()

    // Update DOM
    root.walkDepth((fiber, nodeCursor, setNodeCursor) => {
        if (fiber.type === null) return
        fiber.update(nodeCursor, setNodeCursor)
        fiber.reset()
    })

    // Produce sync effects queued in the "Update DOM" step
    for (const effect of sync) effect()
    sync.length = 0

    // Schedule async effects
    scheduleNextEffect()

    // Process the update queue
    if (queue.update.length) {
        const updates = queue.update.slice()
        reset()
        for (let i=updates.length-1; i>=0; i--) {
            concurrent = false
            update(updates[i])
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