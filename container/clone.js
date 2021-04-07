import Component from './types/Component'
import Element from './types/Element'
import Inline from './types/Inline'
import Value from './types/Value'

export default function clone(data) {

    if (Array.isArray(data)) {
        const arrCopy = []
        data.forEach(container => arrCopy.push(clone(container)))
        return arrCopy
    }

    if (data instanceof Value) return new Value(data.value)

    if (data instanceof Inline) return new Inline(data.inline)
    
    if (data instanceof Element) {
        const element = Object.assign(new Element, data)
        element.children = clone(data.children)
        element.node = null
        return element
    }

    if (data instanceof Component) {
        const component = Object.assign(new Component(data.origin, data.props, data.key), data)
        return component
    }

    return data
}
