import Component, { setPreviousComponent } from './types/Component'
import Element from './types/Element'
import Value from './types/Value'
import unwatch from './unwatch'
import render from './render'

export default function update(container) {

    // Skip value containers
    if (container instanceof Value) return

    // Update component elements
    if (container instanceof Component) {

        setPreviousComponent(container)
        const updatedContainer = new Component(container.origin, container.props)
        unwatch(container.component)

        if (!container.childKeys.length || !updatedContainer.childKeys.length) {
            render(updatedContainer.component)
            replace(container.component, updatedContainer.component)
        } else {
            replaceKeyed(container.component, updatedContainer.component)
        }

        container.states = updatedContainer.states
        container.component = updatedContainer.component
        container.childKeys = updatedContainer.childKeys
        return
    }

    // Defer onUpdate task
    if (container.onUpdate) setTimeout(() => container.onUpdate(container.node))

    // Dynamic attributes
    for (let attr in container.attributes.dynamic) {
        if (attr === 'value') {
            container.node.value = container.attributes.dynamic[attr]()
            continue
        }
        container.node.setAttribute(attr, container.attributes.dynamic[attr]())
    }

    // Update innerHTML
    if (typeof container.html === 'function') {
        container.node.innerHTML = container.html()
        return
    }

    // Update children
    if (!container.dynamic) return
    container.childKeys = []
    container.children.forEach(child => update(child))
}

function replace(currentContainers, newContainers) {

    if (!currentContainers.length || !newContainers.length) return

    const parentNode = currentContainers[0].node.parentNode

    for (let i=0; ; i++) {

        if (currentContainers[i]) {

            if (newContainers[i]) {

                if (
                    currentContainers[i].constructor === newContainers[i].constructor &&
                    (currentContainers[i] instanceof Element && currentContainers[i].type === newContainers[i].type && !Object.values(currentContainers[i].eventListeners).length) ||
                    (currentContainers[i] instanceof Value && currentContainers[i].value === newContainers[i].value)
                ) {

                    if (currentContainers[i] instanceof Element) {
                        newContainers[i].node = currentContainers[i].node
                        replace(currentContainers[i].children, newContainers[i].children)
                        continue
                    }
                    newContainers[i].node = currentContainers[i].node
                    continue
                }
                
                parentNode.replaceChild(newContainers[i].node, currentContainers[i].node)
                continue
            }

            parentNode.removeChild(currentContainers[i].node)
            continue
        }

        if (newContainers[i]) {
            const fragment = document.createDocumentFragment()
            for ( ; i<newContainers.length; i++) fragment.appendChild(newContainers[i].node)
            parentNode.appendChild(fragment)
            return
        }

        return
    }

}

function replaceKeyed(currentContainers, newContainers) {

    const parentNode = currentContainers[0].node.parentNode

    // Swaps the current containers
    const swap = (i, index) => {
        const nextSibling = currentContainers[index].node.nextSibling
        const currentContainerNode = parentNode.replaceChild(currentContainers[index].node, currentContainers[i].node)
        parentNode.insertBefore(currentContainerNode, nextSibling)
        newContainers[i] = currentContainers[index]
        currentContainers[index] = currentContainers[i]
    }

    // Inserts the new container
    const insert = (i) => {
        render(newContainers[i])
        parentNode.insertBefore(newContainers[i].node, currentContainers[i].node)
        currentContainers.unshift(null) // aligns indexes of both arrays
    }

    // Replaces the current container with the new container
    const replaceWithNew = (i) => {
        render(newContainers[i])
        parentNode.replaceChild(newContainers[i].node, currentContainers[i].node)
    }

    // Replaces the current container with the existing new container (actually, with another current container)
    const replaceWithExisting = (i, index) => {
        parentNode.replaceChild(currentContainers[index].node, currentContainers[i].node)
        newContainers[i] = currentContainers[index]
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

                        // Equal keys, so skip
                        if (currentContainers[i].key === newContainers[i].key) {
                            newContainers[i] = currentContainers[i]
                            continue
                        }

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

                    // The key of the new container wasn't found, so replace with the new container
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

                    // The key of the existing new container wasn't found, so replace with the new container
                    // ...
                }

                // Non-keyed current container and non-keyed new container, so replace with the new container
                replaceWithNew(i)
                continue
            }

            // No more new containers, so remove the remaining current containers
            for (let j=currentContainers.length-1; j>=i; j--) parentNode.removeChild(currentContainers[j].node)
            return
        }

        // No more current containers, so append the remaining new containers
        if (newContainers[i]) {
            const fragment = document.createDocumentFragment()
            for ( ; i<newContainers.length; i++) {
                render(newContainers[i])
                fragment.appendChild(newContainers[i].node)
            }
            parentNode.appendChild(fragment)
            return
        }

        // No more containers
        return
    }

}
