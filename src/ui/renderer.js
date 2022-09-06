import * as dom from './dom'
import Fiber, { tag, clone, clean } from './Fiber'
import Element, { Text, Inline, normalize } from './Element'
import { same } from '../utils'
import { resetCursor, effectType, storesWatchers, loseStore } from './Hooks'

export let current = null
let root = null
let next = null
let idleCallbackId = null
const deletions = []
const queue = {
    layoutEffects: [],
    effects: [],
    effectTimeoutId: null
}

/**
 * Initiates the rendering process of the fiber subtree.
 */
export function update(fiber) {

    // Already rendering
    if (root) {
        const parents = []

        let parent = root.alt
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
    current = null
}

/**
 * Renders the fiber tree in concurrent mode.
 */
function render(deadline) {

    // Main loop
    while (deadline.timeRemaining() > 0 && next) {
        current = next
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
            resetCursor()
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
 * Compares the existing child fibers to the new JSX elements and decides which 
 * changes to apply.
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

    // Force sync execution of remaining scheduled effects from previous commit
    if (queue.effects.length) {
        clearTimeout(queue.effectTimeoutId)
        queue.effects.forEach(e => e())
        queue.effects.length = 0
    }

    // Relace the alternate from the main tree with the updated fiber
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

    // Unmount obsolete components
    for (let i=0, n=deletions.length; i<n; i++) {
        walkDepth(deletions[i], unmoutComponent)
    }

    // Mutate DOM
    walkDepth(root, mutate)

    // Remove obsolete nodes from the DOM
    for (let i=0, n=deletions.length; i<n; i++) {
        const fiber = deletions[i]
        if (!fiber.isComponent) {
            fiber.node.parentNode.removeChild(fiber.node)
            continue
        }
        const nodes = getChildNodes(fiber)
        for (let j=0, m=nodes.length; j<m; j++) {
            const node = nodes[j]
            node.parentNode.removeChild(node)
        }
    }

    reset()

    // Produce layout effects
    queue.layoutEffects.forEach(e => e.cleanup = e.fn())
    queue.layoutEffects.length = 0

    // Schedule effects
    scheduleNextEffect()
}

function scheduleNextEffect() {
    if (!queue.effects.length) return
    queue.effectTimeoutId = setTimeout(() => {
        queue.effects.shift()()
        scheduleNextEffect()
    })
}

function unmoutComponent(fiber) {
    if (!fiber.isComponent) return
    fiber.hooks.fiber = null
    fiber.hooks.effects.forEach(e => e.cleanup && e.cleanup())
    fiber.hooks.stores.forEach(store => loseStore(store, fiber))
}

function mutate(fiber) {
    const isComponent = fiber.isComponent
    if (isComponent) side(fiber)
    switch (fiber.tag) {
        case tag.INSERT:
            const node = isComponent ? document.createDocumentFragment() : fiber.node
            if (isComponent) getChildNodes(fiber).forEach(n => node.appendChild(n))
            getParentNode(fiber).insertBefore(node, fiber.relation
                ? fiber.relation.isComponent
                    ? getChildNodes(fiber.relation).pop().nextSibling
                    : fiber.relation.node.nextSibling
                : null)
            break
        case tag.UPDATE:
            if (!isComponent) dom.updateNode(fiber)
            break
    }
    clean(fiber)
}

/**
 * Handles component side effects.
 */
function side(fiber) {

    // Update Hooks to Fiber reference
    fiber.hooks.fiber = fiber

    // Update stores watchers lists
    fiber.alt?.hooks.stores.forEach((store) => {
        const watchers = storesWatchers.get(store)
        const index = watchers.indexOf(fiber.alt)
        if (!~index) watchers.push(fiber)
        else watchers[index] = fiber
    })

    // Handle effects
    fiber.hooks.effects.forEach((effect) => {
        const prev = effect.deps.prev
        const next = effect.deps.next

        // Dependencies unchanged
        if (same(prev, next)) return

        // Depencencies changed
        const cleanup = effect.cleanup
        switch (effect.type) {
            case effectType.EFFECT:
                if (cleanup) queue.effects.push(() => cleanup())
                queue.effects.push(() => effect.cleanup = effect.fn())
                break

            case effectType.LAYOUT:
                if (cleanup) cleanup()
                queue.layoutEffects.push(effect)
                break
        }
        effect.deps.prev = next
    })
}

/**
 * Returns the closest parent node.
 */
function getParentNode(fiber) {
    while (!fiber.parent.node) fiber = fiber.parent
    return fiber.parent.node
}

/**
 * Returns the closest child nodes.
 */
function getChildNodes(mainFiber) {
    const nodes = []
    let fiber = mainFiber.child
    while (true) {
        if (!fiber.isComponent) {
            nodes.push(fiber.node)
        } else if (fiber.child) {
            fiber = fiber.child
            continue
        }
        if (fiber.sibling) {
            fiber = fiber.sibling
            continue
        }
        while (true) {
            fiber = fiber.parent
            if (fiber === mainFiber) return nodes
            if (fiber.sibling) {
                fiber = fiber.sibling
                break
            }
        }
    }
}

/**
 * Walks the tree (depth first) and applies the callback to each fiber.
 */
function walkDepth(mainFiber, callback) {
    let fiber = mainFiber
    let goDeep = true
    while (true) {
        if (goDeep && fiber.child) {
            fiber = fiber.child
            continue
        }
        callback(fiber)
        while (true) {
            if (fiber === mainFiber) return
            if (fiber.sibling) {
                fiber = fiber.sibling
                goDeep = true
                break
            }
            fiber = fiber.parent
            goDeep = false
            break
        }
    }
}
