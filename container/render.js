import Component from './types/Component'
import Value from './types/Value'
import watch from './watch'

export default function render(container, parentNode) {

    // Render a value
    if (container instanceof Value) {
        container.node = document.createTextNode(container.value)
        if (parentNode) parentNode.appendChild(container.node)
        return
    }

    if (container instanceof Array) return container.forEach(item => render(item, parentNode))
    if (container instanceof Component) return render(container.component, parentNode)

    // Render inline container
    if (container.inline != null) {
        const temp = document.createElement('div')
        temp.innerHTML = container.inline
        container.node = temp.childNodes[0];
        if (parentNode) parentNode.appendChild(container.node)
        return
    }

    // Render an Element
    container.node = document.createElement(container.type)

    // Static attributes
    for (let attr in container.attributes.static) {
        container.node.setAttribute(attr, container.attributes.static[attr])
    }

    // Dynamic attributes
    for (let attr in container.attributes.dynamic) {
        if (attr === 'value') {
            container.node.value = container.attributes.dynamic[attr]()
            continue
        }
        container.node.setAttribute(attr, container.attributes.dynamic[attr]())
    }

    // Event listeners
    for (let eventType in container.eventListeners) {
        container.node.addEventListener(eventType, container.eventListeners[eventType].bind(container.node))
    }

    // Watch state
    if (container.dynamic) watch(container)

    // Defer onUpdate task
    if (container.onUpdate) setTimeout(() => container.onUpdate(container.node))

    // Render children or set innerHTML
    if (container.html != null) {
        container.node.innerHTML = typeof container.html === 'function' ? container.html() : container.html
    } else render(container.children, container.node)

    // Mount element
    if (parentNode) parentNode.appendChild(container.node)
}
