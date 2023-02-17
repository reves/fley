import Element, { Fragment } from './ui/Element'

const jsx = (type, props, key) => type === Fragment
    ? props.children
    : new Element(type, props, key)

export {Fragment, jsx, jsx as jsxs }