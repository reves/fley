import * as dom from './dom'
import Fiber, { tag, clone, clean } from './Fiber'
import Element, { Text, Inline, normalize } from './Element'
import { is } from '../utils'
import { loseStore } from './hooks'
import { resetHookIndex, storesWatchers } from './hooks'

/**
 * TODO:
 * - Rewrite some funcs to be without recursion [max callstack problem]
 */

let root = null
let next = null
let idleCallbackId = null
export let currentFiber = null
const deletions = []
const deferredLeyoutEffects = []
const deferredEffects = []
let nextEffectTimeoutId = null

/**
 * Initiates the rendering process of the fiber tree.
 */
export function update(fiber) {

    // Already rendering
    if (root) {
        const alt = root.alt
        const parents = []

        let parent = alt
        while (parent) {
            if (parent.isComponent) parents.push(parent)
            parent = parent.parent
        }

        let superiorFiber = fiber
        while (parents.indexOf(superiorFiber) === -1) {
            superiorFiber = superiorFiber.parent
        }

        reset()
        update(superiorFiber)
        return
    }

    // Schedule rendering
    root = clone(fiber)
    next = root
    idleCallbackId = requestIdleCallback(render)
}

/**
 * Stops the rendering process and resets the data.
 */
function reset() {
    cancelIdleCallback(idleCallbackId)
    idleCallbackId = null
    deletions.length = 0
    root = null
    next = null
    currentFiber = null
}

/**
 * Renders the fiber tree in concurrent mode.
 */
function render(deadline) {

    // Main loop
    while (deadline.timeRemaining() > 0 && next) {
        currentFiber = next
        next = reconcile(next)
    }

    // Schedule next step
    if (next) {
        idleCallbackId = requestIdleCallback(render)
        return
    }

    // Completed
    commit()
}

/**
 * Renders the fiber and initiates the reconciliation process for child fibers. 
 * Returns the next fiber to render.
 */
function reconcile(fiber) {

    switch (true) {
        case fiber.isComponent:
            resetHookIndex()
            reconcileChildren(fiber, normalize(fiber.type(fiber.props)))
            break

        case fiber.type === Text:
        case fiber.type === Inline:
            dom.createNode(fiber)
            break

        default:
            dom.createNode(fiber)
            reconcileChildren(fiber, fiber.props.children)
    }

    if (fiber.child) return fiber.child
    while (fiber) {
        if (fiber.sibling) return fiber.sibling
        if (fiber.parent === root) return null
        fiber = fiber.parent
    }
}

/**
 * Compares the child fibers to the elements and decides which changes to apply.
 */
function reconcileChildren(parent, elements = []) {

    if (!elements.length) elements = [new Element(Text, {value: ''}) ]

    let i = 0
    let alt = parent.alt?.child
    let prevSibling = null
    let fiber = null

    function relate(lookaheadElement = false) {
        if (i === 0) parent.child = fiber
        else prevSibling.sibling = fiber
        prevSibling = fiber
        if (!lookaheadElement && alt) alt = alt.sibling
        i++
    }

    while (true) {

        const element = elements[i]

        // Looked-ahead element
        if (element && element.relation) {
            fiber = clone(element.relation, parent, element.props, tag.INSERT, prevSibling)
            relate(true)
            continue
        }

        if (alt) {

            // Looked-ahead alternate
            if (alt.tag === tag.SKIP) {
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
                            fiber = clone(alt, parent, element.props, tag.UPDATE)
                            relate()
                            continue
                        }

                        // Different keys

                        const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)
                        const elementWithSameKeyAsAlt = getElementByKey(elements, i+1, alt.key)

                        // Found an alternate with the same key as element
                        if (altWithSameKeyAsElement) {

                            altWithSameKeyAsElement.tag = tag.SKIP

                            // Found an element with the same key as alternate
                            if (elementWithSameKeyAsAlt) {
                                const _tag = altWithSameKeyAsElement === alt.sibling ? tag.UPDATE : tag.INSERT
                                fiber = clone(altWithSameKeyAsElement, parent, element.props, _tag, alt)
                                elementWithSameKeyAsAlt.relation = alt
                                relate()
                                continue
                            }

                            // Not found element with the same key as alternate
                            fiber = clone(altWithSameKeyAsElement, parent, element.props, tag.INSERT, alt)
                            deletions.push(alt)
                            relate()
                            continue
                        }

                        // Not found an alternate with the same key as element

                        fiber = new Fiber(element, null, parent, tag.INSERT, alt)

                        // Found an element with the same key as alternate
                        if (elementWithSameKeyAsAlt) {
                            elementWithSameKeyAsAlt.relation = alt
                            relate()
                            continue
                        }

                        // Not found element with the same key as alternate
                        deletions.push(alt)
                        relate()
                        continue
                    }

                    // Keyed alternate and non-keyed element

                    const elementWithSameKeyAsAlt = getElementByKey(elements, i+1, alt.key)
                    fiber = new Fiber(element, null, parent, tag.INSERT, alt)

                    // Found an element with the same key as alternate
                    if (elementWithSameKeyAsAlt) {
                        elementWithSameKeyAsAlt.relation = alt
                        relate()
                        continue
                    }

                    // Not found an element with the same key as alternate
                    deletions.push(alt)
                    relate()
                    continue
                }

                // Keyed element and non-keyed alternate
                if (element.key != null) {

                    const altWithSameKeyAsElement = getSiblingByKey(alt, element.key)

                    // Found an alternate with the same key as element
                    if (altWithSameKeyAsElement) {
                        fiber = clone(altWithSameKeyAsElement, parent, element.props, tag.INSERT, alt)
                        altWithSameKeyAsElement.tag = tag.SKIP
                        deletions.push(alt)
                        relate()
                        continue
                    }

                    // Not found an alternate with the same key as element
                    fiber = new Fiber(element, null, parent, tag.INSERT, alt)
                    deletions.push(alt)
                    relate()
                    continue
                }

                // Both non-keyed

                // Same type
                if (alt.type === element.type) {
                    fiber = clone(alt, parent, element.props, tag.UPDATE)
                    relate()
                    continue
                }

                // Different type
                fiber = new Fiber(element, null, parent, tag.INSERT, alt)
                deletions.push(alt)
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
            fiber = new Fiber(element, null, parent, tag.INSERT, prevSibling)
            relate()
            continue
        }

        break
    }

    // Reset alternates tags
    alt = parent.alt?.child
    while (alt) {
        alt.tag = null
        alt = alt.sibling
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
 * Applies changes to the DOM.
 */
function commit() {

    // Force sync execution of remaining effects
    if (deferredEffects.length) {
        clearTimeout(nextEffectTimeoutId)
        deferredEffects.forEach(e => e())
        deferredEffects.length = 0
    }

    // Relace the alternate with the updated fiber in the tree
    if (root.parent) {
        root.sibling = root.alt.sibling
        if (root.alt.parent.child === root.alt) {
            root.alt.parent.child = root
        } else {
            let prevSibling = root.alt.parent.child
            while (prevSibling.sibling !== root.alt) prevSibling = prevSibling.sibling
            prevSibling.sibling = root
        }
    }

    deletions.forEach(fiber => unmount(fiber))
    mutate(root)
    deletions.forEach(remove)

    // Produce layout effects
    deferredLeyoutEffects.forEach(e => e.cleanup = e.effect())
    deferredLeyoutEffects.length = 0

    // Schedule effects
    scheduleNextEffect()

    reset()
}

function scheduleNextEffect() {
    if (!deferredEffects.length) return
    nextEffectTimeoutId = setTimeout(() => {
        deferredEffects.shift()()
        scheduleNextEffect()
    })
}

/**
 * Unmounts components.
 */
function unmount(fiber, depth = false) {
    if (!fiber) return
    unmount(fiber.child, true)
    if (fiber.isComponent) {
        fiber.hooks.layoutEffects.forEach(e => e.cleanup && e.cleanup())
        fiber.hooks.effects.forEach(e => e.cleanup && e.cleanup())
        fiber.hooks.stores.forEach(s => loseStore(s, fiber))
        fiber.hooks.fiber = null
    }
    if (depth) unmount(fiber.sibling, true)
}

/**
 * Removes nodes from the DOM.
 */
function remove(fiber) {
    if (!fiber.isComponent) fiber.node.parentNode.removeChild(fiber.node)
    else getNodes(fiber.child).forEach(n => n.parentNode.removeChild(n))
}

/**
 * Performs DOM mutations.
 */
function mutate(fiber) {
    if (!fiber) return
    mutate(fiber.child)
    deferEffects(fiber)

    if (fiber.isComponent && fiber.alt) {
        fiber.alt.hooks.stores.forEach(s => {
            const watchers = storesWatchers.get(s)
            const index = watchers.indexOf(fiber.alt)
            if (!~index) watchers.push(fiber)
            else watchers[index] = fiber
        })
        fiber.hooks.fiber = fiber
    }

    switch (fiber.tag) {
        case tag.INSERT:
            const node = fiber.isComponent ? document.createDocumentFragment() : fiber.node
            if (fiber.isComponent) getNodes(fiber.child).forEach(n => node.appendChild(n))
            getParentNode(fiber).insertBefore(node, fiber.relation
                ? fiber.relation.isComponent
                    ? getNodes(fiber.relation.child).pop().nextSibling
                    : fiber.relation.node.nextSibling
                : null)
            break
        case tag.UPDATE:
            if (!fiber.isComponent) dom.updateNode(fiber)
            break
    }

    if (fiber !== root) mutate(fiber.sibling)
    clean(fiber)
}

/**
 * Returns the closest parent node.
 */
function getParentNode(fiber) {
    while (!fiber.parent.node) fiber = fiber.parent
    return fiber.parent.node
}

/**
 * Returns an Array of child and sibling nodes.
 */
function getNodes(fiber) {
    if (!fiber) return []
    const nodes = []
    if (fiber.isComponent) nodes.push(...getNodes(fiber.child))
    else nodes.push(fiber.node)
    nodes.push(...getNodes(fiber.sibling))
    return nodes
}

/**
 * Handles side effects.
 */
function deferEffects(fiber) {
    if (!fiber.isComponent) return

    // Defer layout effects
    let prevEffects = fiber.alt?.hooks.layoutEffects
    fiber.hooks.layoutEffects.forEach((next, i) => {
        if (prevEffects) {
            const prev = prevEffects[i]
            if (depsUnchanged(prev, next)) return
            if (prev.cleanup) prev.cleanup()
        }
        deferredLeyoutEffects.push(next)
    })

    // Defer effects
    prevEffects = fiber.alt?.hooks.effects
    fiber.hooks.effects.forEach((next, i) => {
        if (prevEffects) {
            const prev = prevEffects[i]
            if (depsUnchanged(prev, next)) return
            if (prev.cleanup) deferredEffects.push(() => prev.cleanup())
        }
        deferredEffects.push(() => next.cleanup = next.effect())
    })
}

function depsUnchanged(prev, next) {
    if (prev.deps && prev.deps.every((pd, i) => is(pd, next.deps[i]))) {
        next.cleanup = prev.cleanup
        return true
    }
    return false
}
