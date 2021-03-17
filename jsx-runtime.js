import Element from './container/types/Element'
import Component from './container/types/Component'

function jsx(type, props, key) {

    // Fragment or Component
    if (typeof type === 'function') {
        return new Component(type, props)
    }

    return new Element(type, props, key)
}

function Fragment(props) {
    return props.children
}

export {Fragment, jsx, jsx as jsxs}
