import Element from './container/types/Element'
import Component from './container/types/Component'

function jsx(type, props, key) {
    return (typeof type === 'function') ? new Component(type, props) : new Element(type, props, key)
}

function Fragment(props) {
    return props.children
}

export {Fragment, jsx, jsx as jsxs}
