import Component from './types/Component'
import Element from './types/Element'
import Inline from './types/Inline'
import Value from './types/Value'
import render from './render'

export default function reconcile(currentContainer, newContainer) {

    if (!currentContainer.children.length) return

    if (currentContainer.childKeys.length && newContainer.childKeys.length) {
        replaceKeyed(currentContainer.children, newContainer.children)
        return
    }

    replace(currentContainer.children, newContainer.children)
}

function replace(currentContainers, newContainers) {

    const parentNode = (currentContainers[0] instanceof Component)
        ? currentContainers[0].children[0].node.parentNode
        : currentContainers[0].node.parentNode

    for (let i=0; ; i++) {

        if (currentContainers[i]) {

            // Both containers exist
            if (newContainers[i]) {
                if (diff(currentContainers, newContainers, i)) continue
                render(newContainers[i])
                parentNode.replaceChild(newContainers[i].node, currentContainers[i].node)
                currentContainers[i] = newContainers[i]
                continue
            }

            // No more new containers, so remove the remaining current containers
            for (let j=currentContainers.length-1; j>=i; j--) {
                if (currentContainers[j] instanceof Component) {
                    for (let k=currentContainers[j].children.length-1; k>=0; k--) {
                        parentNode.removeChild(currentContainers[j].children[k].node)
                    }
                    continue
                }
                parentNode.removeChild(currentContainers[j].node)
            }
            currentContainers.splice(i, currentContainers.length - i)
            return
        }

        // No more current containers, so append the remaining new containers
        if (newContainers[i]) {
            const fragment = document.createDocumentFragment()
            for ( ; i<newContainers.length; i++) {
                render(newContainers[i], fragment)
                currentContainers[i] = newContainers[i]
            }
            parentNode.appendChild(fragment)
            return
        }

        // No more containers
        return
    }
}

function replaceKeyed(currentContainers, newContainers) {

    const parentNode = (currentContainers[0] instanceof Component)
        ? currentContainers[0].children[0].node.parentNode
        : currentContainers[0].node.parentNode

    // Swaps the current containers
    const swap = (i, index) => {
        const A = currentContainers[i]
        const B = currentContainers[index]
        const nextSibling = (B instanceof Component)
            ? B.children[B.children.length-1].node.nextSibling
            : B.node.nextSibling

        if (A instanceof Component) {

            if (B instanceof Component) {
                const fragment = document.createDocumentFragment()
                for (let j=0; j<B.children.length; j++) fragment.appendChild(B.children[j].node)
                parentNode.replaceChild(fragment, A.children[0].node)
                for (let j=0; j<A.children.length; j++) fragment.appendChild(A.children[j].node)
                parentNode.insertBefore(fragment, nextSibling)
            } else {
                const fragment = document.createDocumentFragment()
                parentNode.replaceChild(B.node, A.children[0].node)
                for (let j=0; j<A.children.length; j++) fragment.appendChild(A.children[j].node)
                parentNode.insertBefore(fragment, nextSibling)
            }
        } else if (B instanceof Component) {
            const fragment = document.createDocumentFragment()
            for (let j=0; j<B.children.length; j++) fragment.appendChild(B.children[j].node)
            parentNode.replaceChild(fragment, A.node)
            parentNode.insertBefore(A.node, nextSibling)
        } else {
            parentNode.replaceChild(B.node, A.node)
            parentNode.insertBefore(A.node, nextSibling)
        }

        const temp = A
        currentContainers[i] = currentContainers[index]
        currentContainers[index] = temp
    }

    // Inserts the new container
    const insert = (i) => {
        if (currentContainers[i] instanceof Component) {
            if (newContainers[i] instanceof Component) {
                const fragment = document.createDocumentFragment()
                render(newContainers[i], fragment)
                parentNode.insertBefore(fragment, currentContainers[i].children[0].node)
            } else {
                render(newContainers[i])
                parentNode.insertBefore(newContainers[i].node, currentContainers[i].children[0].node)
            }
        } else if (newContainers[i] instanceof Component) {
            const fragment = document.createDocumentFragment()
            render(newContainers[i], fragment)
            parentNode.insertBefore(fragment, currentContainers[i].node)
        } else {
            render(newContainers[i])
            parentNode.insertBefore(newContainers[i].node, currentContainers[i].node)
        }
        currentContainers.splice(i, 0, newContainers[i])
    }

    // Replaces the current container with the new container
    const replaceWithNew = (i) => {
        if (diff(currentContainers, newContainers, i)) return
        render(newContainers[i])
        parentNode.replaceChild(newContainers[i].node, currentContainers[i].node)
        currentContainers[i] = newContainers[i]
    }

    // Replaces the current container with the existing new container (actually, with another current container)
    const replaceWithExisting = (i, index) => {
        const A = currentContainers[i]
        const B = currentContainers[index]

        if (A instanceof Component) {

            if (B instanceof Component) {

                for (let j=0; ; j++) {

                    if (A.children[j]) {

                        if (B.children[j]) {
                            parentNode.replaceChild(B.children[j].node, A.children[j].node)
                            continue
                        }

                        parentNode.removeChild(A.children[j].node)
                        continue
                    }

                    if (B.children[j]) {
                        parentNode.insertBefore(B.children[j].node, B.children[j-1].node.nextSibling)
                    }

                    break
                }

            } else {
                for (let j=A.children.length-1; j>0; j--) {
                    parentNode.removeChild(A.children[j].node)
                }
                parentNode.replaceChild(B.node, A.children[0].node)
            }
            
        } else if (B instanceof Component) {
            const fragment = document.createDocumentFragment()
            for (let j=0; j<B.children.length; j++) fragment.appendChild(B.children[j].node)
            parentNode.replaceChild(fragment, A.node)
        } else {
            parentNode.replaceChild(B.node, A.node)
        }
        currentContainers[i] = currentContainers[index]
        currentContainers.splice(index, 1)
    }

    // Returns true if the key of the current container was found in newContainers
    const foundCurrentInNewContainers = (i) => {
        for (let j=i+1; j<newContainers.length; j++) if (currentContainers[i].key === newContainers[j].key) return true
        return false
    }

    // Returns the index of the current container whose key matches the key of the new container, or -1 if there is no 
    // match
    const getIndexOfCurrentThatMatchesNew = (i) => {
        for (let j=i+1; j<currentContainers.length; j++) if (newContainers[i].key === currentContainers[j].key) return j
        return -1
    }

    for (let i=0; ; i++) {

        if (currentContainers[i]) {

            // Both containers exist
            if (newContainers[i]) {

                if (currentContainers[i].key != null) {

                    // Both containers keyed
                    if (newContainers[i].key != null) {

                        // Skip equal keys
                        if (currentContainers[i].key === newContainers[i].key) continue

                        // Different keys
                        const indexOfCurrentThatMatchesNew = getIndexOfCurrentThatMatchesNew(i)

                        // The key of the current container was found, so the current container will remain
                        if (foundCurrentInNewContainers(i)) {

                            //  The key of the already existing new container was found, both containers remain, so swap
                            if (indexOfCurrentThatMatchesNew !== -1) {
                                swap(i, indexOfCurrentThatMatchesNew)
                                continue
                            }

                            // The key of the new container wasn't found, so insert the new container
                            insert(i)
                            continue
                        }

                        // The key of the current container wasn't found, but the key of the already existing new 
                        // container was found, so replace
                        if (indexOfCurrentThatMatchesNew !== -1) {
                            replaceWithExisting(i, indexOfCurrentThatMatchesNew)
                            continue
                        }

                        // The key of the current container wasn't found, also the key of the new container wasn't 
                        // found, so replace the current container with the new one
                        replaceWithNew(i)
                        continue
                    }

                    // Keyed current container and non-keyed new container

                    // The key of the current container was found, so insert the new container
                    if (foundCurrentInNewContainers(i)) {
                        insert(i)
                        continue
                    }

                    // The key of the current container wasn't found, so replace with the new container
                    replaceWithNew(i)
                    continue
                }

                // Non-keyed current container and keyed new container
                if (newContainers[i].key != null) {

                    const indexOfCurrentThatMatchesNew = getIndexOfCurrentThatMatchesNew(i)

                    // The key of the existing new container was found, so replace
                    if (indexOfCurrentThatMatchesNew !== -1) {
                        replaceWithExisting(i, indexOfCurrentThatMatchesNew)
                        continue
                    }

                    // The key of the existing new container wasn't found, so replace with the new container:
                    // --->
                }

                // Non-keyed current container and non-keyed new container, so replace with the new container
                replaceWithNew(i)
                continue
            }

            // No more new containers, so remove the remaining current containers
            for (let j=currentContainers.length-1; j>=i; j--) {
                if (currentContainers[j] instanceof Component) {
                    for (let k=currentContainers[j].children.length-1; k>=0; k--) {
                        parentNode.removeChild(currentContainers[j].children[k].node)
                    }
                    continue
                }
                parentNode.removeChild(currentContainers[j].node)
            }
            currentContainers.splice(i, currentContainers.length - i)
            return
        }

        // No more current containers, so append the remaining new containers
        if (newContainers[i]) {
            const fragment = document.createDocumentFragment()
            for ( ; i<newContainers.length; i++) {
                render(newContainers[i], fragment)
                currentContainers[i] = newContainers[i]
            }
            parentNode.appendChild(fragment)
            return
        }

        // No more containers
        return
    }

}

function diff(currentContainers, newContainers, i) {

    const currentContainer = currentContainers[i]
    const newContainer = newContainers[i]

    if (currentContainer instanceof Component) {

        // Both containers are Components
        if (newContainer instanceof Component) {

            // Update same Component
            if (currentContainer.origin === newContainer.origin) {
                currentContainer.update(newContainer.props, newContainer.key)
                return true
            }

            // Replace Components children
            reconcile(currentContainer, newContainer)
            return true
        }

        // The current container is a Component and the new container is not
        const firstChildNode = currentContainer.children[0].node
        const parentNode = firstChildNode.parentNode

        render(newContainer)

        for (let j=currentContainer.children.length-1; j>0; j--) {
            parentNode.removeChild(currentContainer.children[j].node)
        }

        parentNode.replaceChild(newContainer.node, firstChildNode)
        currentContainers[i] = newContainer

        return true
    }

    // The new container is a Component and the current container is not
    if (newContainer instanceof Component) {

        const fragment = document.createDocumentFragment()

        render(newContainer, fragment)
        currentContainer.node.parentNode.replaceChild(fragment, currentContainer.node)
        currentContainers[i] = newContainer 

        return true
    }

    // Same type containers
    if (currentContainer.constructor === newContainer.constructor) {

        // Skip same Value containers
        if (currentContainer instanceof Value) {
            if (currentContainer.value === newContainer.value) return true
            return false
        }

        // Skip same Inline containers
        if (currentContainer instanceof Inline) {
            if (currentContainer.inline === newContainer.inline) return true
            return false
        }

        // Update same type Elements
        if (currentContainer instanceof Element && currentContainer.type === newContainer.type) {

            // attributes

            for (const attr in currentContainer.attributes) {
                
                // the attribute exists in the new container
                if (newContainer.attributes[attr] != null) {

                    // skip same attribute values
                    if (currentContainer.attributes[attr] === newContainer.attributes[attr]) continue

                    // update attribute values
                    currentContainer.node.setAttribute(attr, newContainer.attributes[attr])
                    continue
                }

                // remove the current container attributes not present in the new container
                currentContainer.node.removeAttribute(attr)

            }

            for (const attr in newContainer.attributes) {

                if (attr === 'value') {
                    currentContainer.node.value = newContainer.attributes[attr]
                    continue
                }

                // skip already processed attributes
                if (currentContainer.attributes[attr] != null) continue

                // set the new attributes
                currentContainer.node.setAttribute(attr, newContainer.attributes[attr])

            }

            currentContainer.attributes = newContainer.attributes

            // event listeners

            for (let eventType in currentContainer.eventListeners) {
                currentContainer.node[eventType] = null
            }

            for (let eventType in newContainer.eventListeners) {
                currentContainer.node[eventType] = newContainer.eventListeners[eventType]
            }

            currentContainer.eventListeners = newContainer.eventListeners

            // Set/update innerHTML
            if (newContainer.html != null) {
                currentContainer.node.innerHTML = newContainer.html
                currentContainer.html = newContainer.html
                currentContainer.children = []
                return true
            }

            // Clear innerHTML and append new children
            if (currentContainer.html != null) {
                const fragment = document.createDocumentFragment()
                for (let i=0; i<newContainer.children.length; i++) render(newContainer.children[i], fragment)
                currentContainer.node.innerHTML = ''
                currentContainer.node.appendChild(fragment)
                currentContainer.children = newContainer.children
                return true
            }
            
            // Replace children
            reconcile(currentContainer, newContainer)
            currentContainer.key = newContainer.key
            currentContainer.childKeys = newContainer.childKeys
            return true
        }
    }

    return false
}
