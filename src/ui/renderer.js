import Fiber, { tag } from './Fiber'
import Element, { Text, Fragment, Inline, normalize } from './Element'
import { statesWatchers } from '../State'

export let currentFiber = null

let WIP = null
let next = null
let idleCallbackId = null
let deletes = []

export function dispatchUpdate(fiber) {

    if (!WIP) WIP = fiber.clone()
    else if (idleCallbackId != null) cancelIdleCallback(idleCallbackId)

    deletes = []
    next = WIP

    // Start rendering
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

    // Reconcilation paused, continue later
    if (next) {
        idleCallbackId = requestIdleCallback(render)
        return
    }

    // Reconcilation complete, apply changes
    commit()
    WIP = null
    deletes = []
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

            // Event listeners
            if (/^on.+/i.test(prop)) {
                node[prop.toLowerCase()] = props[prop]
                continue
            }

            // Attributes
            switch (typeof props[prop]) {
                case 'function':
                    props[prop] = props[prop]()
                    if (typeof props[prop] === 'boolean') {
                        if (props[prop]) node.setAttribute(prop, '')
                        continue
                    }
                    if (props[prop] != null) node.setAttribute(prop, props[prop])
                    continue

                case 'boolean':
                    if (props[prop]) node.setAttribute(prop, '')
                    continue

                default:
                    if (props[prop] != null) node.setAttribute(prop, props[prop])
                    continue
            }
        }
    }

    if (fiber.props.children) reconcileChildren(fiber, fiber.props.children)
}

function updateHostText(fiber) {
    if (!fiber.node) fiber.node = document.createTextNode(fiber.props.value)
}

function updateHostInline(fiber) {
    if (!fiber.node) {
        const temp = document.createElement('div')
        temp.innerHTML = fiber.props.html || ''
        fiber.node = temp.childNodes[0] || document.createTextNode('');
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
    let fiber = WIP.alternate

    if (fiber.parent) {
        
        const parent = fiber.parent
        
        if (parent.child === fiber) {

            parent.child = WIP

        } else {

            let sibling = parent.child

            while (sibling) {
                if (sibling.nextSibling === fiber) {
                    sibling.nextSibling = WIP
                    break
                }
                sibling = sibling.nextSibling
            }

        }
        
        WIP.nextSibling = fiber.nextSibling
    }

    // Update DOM
    fiber = WIP

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
                        } else if (fiber.type === Inline) {}
                        else {
                            
                            const node = fiber.node

                            // Remove old
                            let props = fiber.alternate.props

                            for (const prop in props) {

                                // Reserved prop
                                if (prop === 'children') continue

                                // Event listeners
                                if (/^on.+/i.test(prop)) {
                                    node[prop.toLowerCase()] = null
                                    continue
                                }

                                // Attributes
                                node.removeAttribute(prop)
                            }

                            // Set new
                            props = fiber.props

                            for (const prop in props) {

                                // Reserved prop
                                if (prop === 'children') continue

                                // Event listeners
                                if (/^on.+/i.test(prop)) {
                                    node[prop.toLowerCase()] = props[prop]
                                    continue
                                }

                                // Attributes
                                switch (typeof props[prop]) {
                                    case 'function':
                                        props[prop] = props[prop]()
                                        if (typeof props[prop] === 'boolean') {
                                            if (props[prop]) node.setAttribute(prop, '')
                                            continue
                                        }
                                        if (props[prop] != null) node.setAttribute(prop, props[prop])
                                        continue

                                    case 'boolean':
                                        if (props[prop]) node.setAttribute(prop, '')
                                        continue

                                    default:
                                        if (props[prop] != null) node.setAttribute(prop, props[prop])
                                        continue
                                }
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

    // Deletes
    for (let i=0; i<deletes.length; i++) {

        const fiber = deletes[i]

        // remove state watchers
        const theFiber = fiber

        while (theFiber) {

            if (theFiber.isComponent && theFiber.watching.length) {
                
                theFiber.watching.forEach(globalState => {
                    const watchers = statesWatchers.get(globalState)

                    const index = watchers.indexOf(theFiber)
                    watchers.splice(index, 1)
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

        // Remove nodes
        if (!fiber.isComponent) {
            fiber.node.parentNode.removeChild(fiber.node)
            continue
        }

        getClosestChildrenWithNodes(fiber).forEach(f => f.node.parentNode.removeChild(f.node))
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
