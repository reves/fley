import Component from './types/Component'
import Inline from './types/Inline'
import Value from './types/Value'

export default function render(container, parentNode) {

    // Value
    if (container instanceof Value) {
        container.node = document.createTextNode(container.value)
        if (parentNode) parentNode.appendChild(container.node)
        return
    }

    // Component
    if (container instanceof Component) return render(container.children, parentNode)

    // Array
    if (Array.isArray(container)) return container.forEach(item => render(item, parentNode))

    // Inline
    if (container instanceof Inline) {
        const temp = document.createElement('div')
        temp.innerHTML = container.inline
        container.node = temp.childNodes[0];
        if (parentNode) parentNode.appendChild(container.node)
        return
    }

    // Element

    // node
    container.node = document.createElement(container.type)

    // attributes
    for (const attr in container.attributes) {
        container.node.setAttribute(attr, container.attributes[attr])
    }

    // event listeners
    for (let eventType in container.eventListeners) {
        container.node[eventType] = container.eventListeners[eventType]
    }

    // Defer onUpdate task
    // if (container.onUpdate) setTimeout(() => container.onUpdate(container.node))

    // Render children or set innerHTML
    if (container.html == null) render(container.children, container.node)
    else container.node.innerHTML = container.html

    // Mount the Element
    if (parentNode) parentNode.appendChild(container.node)
}
