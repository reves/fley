import Fiber, { TAG_SKIP, TAG_INSERT } from './Fiber'
import { Text, Inline, normalize } from './Element'
import { resetCursor } from './hooks'
import { isBrowser } from '../utils'

let syncOnly = false
export const setSyncOnly = _ => syncOnly = true
let concurrent = false
let root = null
let next = null
let idleCallbackId = null
const deletions = []
export let current = null
export const queue = {
    update: [],
    sync: [],
    async: [],
    timeoutId: null,
    reset: []
}
export let hydration = false

/**
 * Initiates the rendering process of the fiber subtree.
 */
export function update(fiber, hydrate = false) {
    hydration = hydrate

    // Already rendering
    if (root) {
        // Root itself or its ancestor
        let parent = root.alt
        while (parent) {
            if (fiber === parent) {
                reset()
                update(fiber)
                return
            }
            parent = parent.parent
        }
        // Descendant or other branch
        queue.update.push(fiber)
        return
    }

    // Init the rendering process
    root = fiber.clone()
    next = root
    if (!concurrent) return render()
    idleCallbackId = requestIdleCallback(render)
}

/**
 * Cancels the rendering process and resets the data.
 */
function reset() {
    if (idleCallbackId != null) cancelIdleCallback(idleCallbackId)
    idleCallbackId = null
    root = null
    next = null
    current = null
    deletions.length = 0
    queue.sync.length = 0
    queue.update = []
    for (const res of queue.reset) res()
    if (!syncOnly) concurrent = true
    hydration = false
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

    if (fiber.isComponent) {
        resetCursor()
        reconcileChildren(fiber, normalize(type(fiber.props)), fiber.tag)
    } else {
        if (!fiber.node && isBrowser && !hydration) fiber.createNode()
        if (type !== Text && type !== Inline) {
            reconcileChildren(fiber, fiber.props.children)
        }
    }

    if (fiber.child) return fiber.child
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
function reconcileChildren(parent, elements = [], parentTag) {
    let i = 0
    let alt = parent.alt?.child
    let prev = null
    let fiber = null

    const relate = (lookaheadElement = false) => {
        if (!lookaheadElement && alt) alt = alt.sibling
        if (i === 0) { parent.child = fiber } else { prev.sibling = fiber }
        prev = fiber
        i++
    }
    const scheduleDeletion = (obsolete = false) => 
        (obsolete || alt.isComponent || fiber.isComponent) && deletions.push(alt)

    while (true) {

        const element = elements[i]

        // Looked-ahead element
        if (element?.relation) {
            fiber = element.relation.clone(parent, element.props, TAG_INSERT)
            relate(true)
            continue
        }

        if (alt) {

            // Looked-ahead alternate
            if (alt.tag === TAG_SKIP) {
                alt.tag = null
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
                            fiber = alt.clone(parent, element.props, parentTag)
                            relate()
                            continue
                        }

                        // Different keys

                        const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)
                        const elementWithSameKeyAsAlt = getElementByKey(elements, i+1, alt.key)

                        // Found an alternate with the same key as element
                        if (altWithSameKeyAsElement) {

                            altWithSameKeyAsElement.tag = TAG_SKIP
                            fiber = altWithSameKeyAsElement.clone(parent, element.props, TAG_INSERT, alt)

                            // Found an element with the same key as alternate
                            if (elementWithSameKeyAsAlt) {
                                elementWithSameKeyAsAlt.relation = alt
                                relate()
                                continue
                            }

                            // Not found element with the same key as alternate
                            scheduleDeletion()
                            relate()
                            continue
                        }

                        // Not found an alternate with the same key as element

                        fiber = new Fiber(element, null, parent, TAG_INSERT, alt)

                        // Found an element with the same key as alternate
                        if (elementWithSameKeyAsAlt) {
                            elementWithSameKeyAsAlt.relation = alt
                            relate()
                            continue
                        }

                        // Not found element with the same key as alternate
                        scheduleDeletion()
                        relate()
                        continue
                    }

                    // Keyed alternate and non-keyed element

                    const elementWithSameKeyAsAlt = getElementByKey(elements, i+1, alt.key)

                    // Found an element with the same key as alternate
                    if (elementWithSameKeyAsAlt) {
                        fiber = new Fiber(element, null, parent, TAG_INSERT)
                        elementWithSameKeyAsAlt.relation = alt
                        relate()
                        continue
                    }

                    // Not found an element with the same key as alternate
                    fiber = new Fiber(element, null, parent, TAG_INSERT, alt)
                    scheduleDeletion()
                    relate()
                    continue
                }

                // Keyed element and non-keyed alternate
                if (element.key != null) {

                    const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)

                    // Found an alternate with the same key as element
                    if (altWithSameKeyAsElement) {
                        altWithSameKeyAsElement.tag = TAG_SKIP
                        fiber = altWithSameKeyAsElement.clone(parent, element.props, TAG_INSERT, alt)
                        scheduleDeletion()
                        relate()
                        continue
                    }

                    // Not found an alternate with the same key as element
                    fiber = new Fiber(element, null, parent, TAG_INSERT, alt)
                    scheduleDeletion()
                    relate()
                    continue
                }

                // Both non-keyed

                // Same type
                if (alt.type === element.type) {
                    fiber = alt.clone(parent, element.props, parentTag)
                    relate()
                    continue
                }

                // Different type
                fiber = new Fiber(element, null, parent, TAG_INSERT, alt)
                scheduleDeletion()
                relate()
                continue
            }

            // Alternate exists but element does not
            deletions.push(alt)
            alt = alt.sibling
            continue
        }

        // Element exists but alternate does not
        if (element) {
            fiber = new Fiber(element, null, parent, TAG_INSERT)
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

function getElementByKey(elements, startIndex, key) {
    for (let i=startIndex, n=elements.length; i<n; i++) {
        if (elements[i].key === key) return elements[i]
    }
    return null
}

/**
 * Applies changes.
 */
function commit() {
    if (!isBrowser) return [root, reset]

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
    for (const fiber of deletions) fiber.unmount()

    // Update DOM
    root.walkDepth((fiber, nodeCursor) => {
        fiber.update(nodeCursor)
        fiber.reset()
    })

    // Produce sync effects queued in the "Update DOM" step
    for (const effect of sync) effect()
    sync.length = 0

    // Schedule async effects
    scheduleNextEffect()

    // Done
    const updateQueue = queue.update
    reset()
    for (let i=updateQueue.length-1; i>=0; i--) {
        concurrent = false
        const fiber = updateQueue[i]
        fiber && update(fiber)
    }
}

function scheduleNextEffect() {
    const async = queue.async
    if (!async.length) return
    queue.timeoutId = setTimeout(() => {
        async.shift()()
        scheduleNextEffect()
    })
}