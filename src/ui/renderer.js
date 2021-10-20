import Fiber, { tag } from './Fiber'
import Element, { Text, Fragment, Inline, normalize } from './Element'
import { statesWatchers } from '../State'
import is from '../utils/is'

export let currentFiber = null

let WIP = null
let next = null
let idleCallbackId = null
let deletes = []
export let queue = []

function replaceBackStateWatchers(fiber) {

    let theFiber = fiber

    while (theFiber) {

        if (theFiber.isComponent && theFiber.watching.length) {
            
            theFiber.watching.forEach(globalState => {
                const watchers = statesWatchers.get(globalState)
                const index = watchers.indexOf(theFiber)
                if (index === -1) return
                watchers[index] = theFiber.alternate
            })

        }

        if (theFiber.child) {
            theFiber = theFiber.child
            continue
        }

        if (theFiber.sibling) {
            theFiber = theFiber.sibling
            continue
        }

        while (theFiber.parent && !theFiber.parent.sibling) {
            theFiber = theFiber.parent
            if (theFiber === fiber) break
        }

        if (theFiber === fiber || !theFiber.parent || theFiber.parent === fiber) break

        theFiber = theFiber.parent.sibling
    }
}

export function dispatchUpdate(fiber) {

    // Work already in progress
    if (WIP) {

        // TODO: Rewrite (not working properly atm)
        // Same fiber, so revert the changes of the current work progress and start again
        /* if (WIP.alternate === fiber) {

            // TODO: set timeout and render once a while, so the user can see the progress

            // Replace back state watchers
            replaceBackStateWatchers(WIP)

            WIP = WIP.alternate.clone()
            next = WIP
            deletes = []

            // Re-schedule rendering
            cancelIdleCallback(idleCallbackId)
            idleCallbackId = requestIdleCallback(render, {timeout: 1000/60})
            return
        } */

        // Different fiber, so let the current work to be done and queue this one
        if (queue.indexOf(fiber) !== -1) return

        queue.push(fiber)
        fiber.inQueue = true
        return
    }

    // Start work
    WIP = fiber.clone()
    next = WIP

    // Schedule rendering
    idleCallbackId = requestIdleCallback(render)
}

function render(deadline) {

    let pause = false

    // Reconcilation loop
    while (!pause && next) {
        currentFiber = next
        next = reconcile(next)
        pause = deadline.timeRemaining() < 1
    }

    // Reconcilation paused, schedule next step
    if (next) {
        idleCallbackId = requestIdleCallback(render)
        return
    }

    // Reconcilation complete, apply changes
    commit()
}

function reconcile(fiber) {
    
    switch (true) {
        case fiber.type === null:
            reconcileChildren(fiber, fiber.props.children)
            break

        case fiber.type === Text:
            updateHostText(fiber)
            break

        case fiber.type === Inline:
            updateHostInline(fiber)
            break

        case typeof fiber.type === 'function':
            updateHostComponent(fiber)
            break

        default:
            updateHostElement(fiber)
    }

    // Retrun next Fiber

    if (fiber.child && !fiber.skipReconcile) return fiber.child

    while (fiber) {
        if (fiber.sibling) return fiber.sibling
        fiber = fiber.parent
        if (fiber === WIP) return null
    }

    return fiber
}

function updateHostComponent(fiber) {
    if (fiber.skipReconcile) return
    reconcileChildren(fiber, normalize(fiber.type(fiber.props)))
}

function updateHostElement(fiber) {

    if (!fiber.node) {

        fiber.node = document.createElement(fiber.type)

        const props = fiber.props
        const node = fiber.node

        for (const prop in props) {

            // Reserved prop
            if (prop === 'children') continue

            // Ref
            if (prop === 'ref') {
                props[prop].current = node
                continue
            }

            // Set event listener
            if (/^on.+/i.test(prop)) {
                node[prop.toLowerCase()] = props[prop]
                continue
            }

            // Set attribute
            if (typeof props[prop] === 'boolean' && props[prop]) node.setAttribute(prop, '')
            else if (props[prop] != null) node.setAttribute(prop, props[prop])
            
        }
    }

    reconcileChildren(fiber, fiber.props.children)
}

function updateHostText(fiber) {
    if (!fiber.node) fiber.node = document.createTextNode(fiber.props.value)
}

function updateHostInline(fiber) {
    if (!fiber.node) {
        const temp = document.createElement('div')
        temp.innerHTML = fiber.props.html || ''
        fiber.node = temp.childNodes[0] || document.createTextNode('');

        const props = fiber.props
        const node = fiber.node

        for (const prop in props) {

            // Reserved prop
            if (prop === 'children') continue

            // Set Ref
            if (prop === 'ref') {
                props[prop].current = node
                continue
            }

            // Set event listener
            if (/^on.+/i.test(prop)) {
                node[prop.toLowerCase()] = props[prop]
                continue
            }

            // Set attribute
            if (typeof props[prop] === 'boolean' && props[prop]) node.setAttribute(prop, '')
            else if (props[prop] != null) node.setAttribute(prop, props[prop])

        }
    }
}

function reconcileChildren(parentFiber, children = []) {
    
    // Placeholder
    if (!children.length) children = [new Element(Text, {value: ''})]

    let alternate = parentFiber.alternate?.child
    let prevSibling = null
    let i = 0
    let fiber = null

    function relate() {
        if (i === 0) parentFiber.child = fiber
        else prevSibling.sibling = fiber
        prevSibling = fiber
        if (alternate) alternate = alternate.sibling
        i++
    }

    while (true) {

        const element = children[i]
        fiber = null

        if (element && element.alternateWithSameKey) {
            fiber = element.alternateWithSameKey.cloneTree(parentFiber)
            fiber.tag = tag.MOVE
            fiber.relFiber = prevSibling
            prevSibling.sibling = fiber
            prevSibling = fiber
            i++
            continue
        }

        if (alternate) {

            if (alternate.skip) {
                alternate = alternate.sibling
                continue
            }

            // Both exist
            if (element) {

                if (alternate.key != null) {

                    // Both keyed
                    if (element.key != null) {

                        // Equal keys
                        if (alternate.key === element.key) {
                            fiber = alternate.cloneTree(parentFiber)
                            fiber.tag = tag.SAVE
                            relate(); continue
                        }

                        // Different keys

                        const alternateWithSameKeyAsElement = getSiblingByKey(alternate, element.key)
                        const elementWithSameKeyAsAlternate = getElementByKey(children, i+1, alternate.key)

                        // Found an alternate with the same key as element
                        if (alternateWithSameKeyAsElement) {

                            alternateWithSameKeyAsElement.skip = true
                            fiber = alternateWithSameKeyAsElement.cloneTree(parentFiber)
                            fiber.tag = tag.MOVE
                            fiber.relFiber = alternate

                            // Found an element with the same key as alternate
                            if (elementWithSameKeyAsAlternate) {
                                elementWithSameKeyAsAlternate.alternateWithSameKey = alternate
                                relate(); continue
                            }

                            // Not found element with the same key as alternate
                            deletes.push(alternate)
                            relate(); continue
                        }

                        // Not found an alternate with the same key as element

                        fiber = Fiber.from(element, parentFiber)
                        fiber.tag = tag.INSERT
                        fiber.relFiber = alternate

                        // Found an element with the same key as alternate
                        if (elementWithSameKeyAsAlternate) {
                            elementWithSameKeyAsAlternate.alternateWithSameKey = alternate
                            relate(); continue
                        }

                        // Not found element with the same key as alternate
                        deletes.push(alternate)
                        relate(); continue
                    }

                    // Keyed alternate and non-keyed element

                    const elementWithSameKeyAsAlternate = getElementByKey(children, i+1, alternate.key)
                    fiber = Fiber.from(element, parentFiber)
                    fiber.tag = tag.INSERT
                    fiber.relFiber = alternate

                    // Found an element with the same key as alternate
                    if (elementWithSameKeyAsAlternate) {
                        elementWithSameKeyAsAlternate.alternateWithSameKey = alternate
                        relate(); continue
                    }

                    // Not found an element with the same key as alternate
                    deletes.push(alternate)
                    relate(); continue
                }

                // Keyed element and non-keyed alternate
                if (element.key != null) {
                    
                    const alternateWithSameKeyAsElement = getSiblingByKey(alternate, element.key)

                    // Found an alternate with the same key as element
                    if (alternateWithSameKeyAsElement) {
                        alternateWithSameKeyAsElement.skip = true
                        fiber = alternateWithSameKeyAsElement.cloneTree(parentFiber)
                        fiber.tag = tag.MOVE
                        fiber.relFiber = alternate
                        deletes.push(alternate)
                        relate(); continue
                    }

                    // Not found an alternate with the same key as element
                    fiber = Fiber.from(element, parentFiber)
                    fiber.tag = tag.INSERT
                    fiber.relFiber = alternate
                    deletes.push(alternate)
                    relate(); continue
                }

                // Both non-keyed

                // Same type
                if (alternate.type === element.type) {
                    fiber = alternate.clone(parentFiber, element.props)
                    fiber.tag = tag.UPDATE
                    relate(); continue
                }

                // Different type
                fiber = Fiber.from(element, parentFiber)
                fiber.tag = tag.INSERT
                fiber.relFiber = alternate
                deletes.push(alternate)
                relate(); continue
            }

            // Alternate exists and element does not
            deletes.push(alternate)
            alternate = alternate.sibling
            continue
        }

        // Element exists and alternate does not
        if (element) {
            fiber = Fiber.from(element, parentFiber)
            fiber.tag = tag.INSERT
            fiber.relFiber = prevSibling
            relate(); continue
        }

        break
    }
}

function getSiblingByKey(fiber, key) {
    fiber = fiber.sibling
    while(fiber && fiber.key !== key) fiber = fiber.sibling
    return fiber
}

function getElementByKey(elements, startIndex, key) {
    for (let i=startIndex, n=elements.length; i<n; i++) {
        if (elements[i].key === key) return elements[i]
    }
    return null
}

function commit() {

    // Replace the updated fiber in the tree
    let alternate = WIP.alternate

    if (alternate.parent) {

        // First sibling
        if (alternate.parent.child === alternate) { 
            
            alternate.parent.child = WIP

        // Further sibling
        } else { 
            let child = alternate.parent.child
            while (child && child.sibling !== alternate) child = child.sibling
            if (child) child.sibling = WIP

        }

        WIP.sibling = alternate.sibling
    }

    // Update DOM
    let onUpdateQueue = []
    let fiber = WIP

    if (fiber.effects.length) onUpdateQueue.push(fiber)

    while (fiber) {

        if (fiber.type !== Fragment) {
            switch (fiber.tag) {
                case tag.INSERT:
                case tag.MOVE:

                    if (fiber.mounted) break

                    if (fiber.relFiber && fiber.relFiber.isComponent) {
                        fiber.relFiber = getClosestChildrenWithNodes(fiber.relFiber).pop()
                    }

                    const parentNode = getClosestParentNode(fiber)
                    const relFiber = fiber.relFiber

                    if (!fiber.isComponent) {
                        parentNode.insertBefore(fiber.node, relFiber ? relFiber.node.nextSibling : null)
                        break
                    }

                    if (fiber.effects.length) onUpdateQueue.push(fiber)

                    const fragment = document.createDocumentFragment()
                    const fibersWithNodes = getClosestChildrenWithNodes(fiber)

                    fibersWithNodes.forEach(f => {
                        if (f.mounted) return
                        fragment.appendChild(f.node)
                        f.mounted = true
                    })

                    parentNode.insertBefore(fragment, relFiber ? relFiber.node.nextSibling : null)
                    fiber.mounted = true
                    break

                case tag.UPDATE:

                    if (!fiber.isComponent) {
                        
                        if (fiber.type === Text) {
                            if (fiber.props.value !== fiber.alternate.props.value && fiber.node.nodeValue !== fiber.props.value+'') fiber.node.nodeValue = fiber.props.value
                        } else {

                            const node = fiber.node
                            const propsPrev = fiber.alternate.props
                            const propsCurr = fiber.props

                            // Previous props
                            for (const prop in propsPrev) {

                                // Reserved prop
                                if (prop === 'children') continue

                                // Unset Ref
                                if (prop === 'ref') {
                                    propsPrev[prop].current = null
                                    continue
                                }

                                // Unset event listener
                                if (/^on.+/i.test(prop)) {
                                    node[prop.toLowerCase()] = null
                                    continue
                                }

                                // Skip same attributes, to compare values later
                                if (propsCurr[prop] !== undefined) continue

                                // Remove attribute
                                node.removeAttribute(prop)
                            }

                            // Current props
                            for (const prop in propsCurr) {

                                // Reserved prop
                                if (prop === 'children') continue

                                // Set Ref
                                if (prop === 'ref') {
                                    propsCurr[prop].current = node
                                    continue
                                }

                                // Set event listener
                                if (/^on.+/i.test(prop)) {
                                    node[prop.toLowerCase()] = propsCurr[prop]
                                    continue
                                }

                                // Skip same value attributes
                                if (propsPrev[prop] !== undefined && propsPrev[prop] === propsCurr[prop]) continue

                                // Set attribute value
                                if (typeof propsCurr[prop] === 'boolean' && propsCurr[prop]) node.setAttribute(prop, '')
                                else if (propsCurr[prop] != null) node.setAttribute(prop, propsCurr[prop])
                                else node.removeAttribute(prop)

                            }

                        }

                    }

                    break
            }
        }

        if (fiber.child && !(fiber.tag === tag.MOVE || fiber.tag === tag.SAVE)) {
            fiber = fiber.child
            continue
        }

        if (fiber.sibling) {
            fiber = fiber.sibling
            continue
        }

        while (fiber.parent && !fiber.parent.sibling) {
            fiber = fiber.parent
            if (fiber === WIP) break
        }

        if (fiber === WIP || !fiber.parent || fiber.parent === WIP) break

        fiber = fiber.parent.sibling
    }

    if (alternate.effectsCleanups.length) {
        alternate.effectsCleanups.forEach(cleanup => {
            if (cleanup) cleanup()
        })
    }

    // Deletes
    for (let i=0; i<deletes.length; i++) {

        const fiber = deletes[i]

        // Remove state watchers && run cleanups
        let theFiber = fiber

        while (theFiber) {

            if (theFiber.isComponent) {
                
                if (theFiber.watching.length) {
                        theFiber.watching.forEach(globalState => {
                            const watchers = statesWatchers.get(globalState)

                            const index = watchers.indexOf(theFiber)
                            watchers.splice(index, 1)
                        })

                        // theFiber.watching = []
                }

                if (theFiber.effectsCleanups.length) {
                    theFiber.effectsCleanups.forEach(cleanup => {
                        if (cleanup) cleanup()
                    })
                }

            }

            if (theFiber.child) {
                theFiber = theFiber.child
                continue
            }

            if (theFiber.sibling) {
                theFiber = theFiber.sibling
                continue
            }

            while (theFiber.parent && !theFiber.parent.sibling) {
                theFiber = theFiber.parent
                if (theFiber === fiber) break
            }

            if (theFiber === fiber || !theFiber.parent || theFiber.parent === fiber) break

            theFiber = theFiber.parent.sibling
        }

        // Remove nodes
        if (!fiber.isComponent) {
            if (fiber.node.parentNode) fiber.node.parentNode.removeChild(fiber.node)
            continue
        }

        getClosestChildrenWithNodes(fiber).forEach(f => f.node.parentNode.removeChild(f.node))
    }

    WIP = null
    deletes = []

    const fromQueue = queue.shift()

    if (fromQueue) {
        dispatchUpdate(fromQueue)
        fromQueue.inQueue = false
    }

    // Effect
    if (onUpdateQueue.length) {
        for (let i=onUpdateQueue.length-1; i>-1; i--) {
            let fiber = onUpdateQueue[i];
            fiber.effects.forEach((effect, index) => {
                if (!effect) return;
                if (!fiber.alternate || fiber.effectsDependencies[index] === null) return fiber.effectsCleanups[index] = effect()
                if (!fiber.effectsDependencies[index].length) return

                const prevDeps = fiber.alternate.effectsDependencies[index]
                const currDeps = fiber.effectsDependencies[index]
                let changed = false

                for (let j=0; j<currDeps.length; j++) {
                    if (!is(prevDeps[j], currDeps[j])) {
                        changed = true
                        break
                    }
                }

                if (changed) return fiber.effectsCleanups[index] = effect()
            })
        }
        onUpdateQueue = []
    }
}

function getClosestParentNode(fiber) {
    while (!fiber.parent.node) fiber = fiber.parent
    return fiber.parent.node
}

function getClosestChildrenWithNodes(fiber) {
    const result = []
    let current = fiber.child

    while (current) {

        if (!current.node) {
            current = current.child
            continue
        }

        result.push(current)

        if (current.sibling) {
            current = current.sibling
            continue
        }

        while (current.parent !== fiber && !current.parent.sibling) {
            if (current === fiber) return result
            current = current.parent
        }

        if (current.parent === fiber) return result
        
        current = current.parent.sibling

    }

    return result
}
