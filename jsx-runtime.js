import Element from './container/types/Element'
import Component from './container/types/Component'
import normalize from './container/normalize'

const Fragment = {}

function jsx(type, props, key) {
    if (typeof type === 'string') return new Element(type, props, key)
    return type === Fragment ? normalize(props.children) : new Component(type, props, key)
}

export {Fragment, jsx, jsx as jsxs}
