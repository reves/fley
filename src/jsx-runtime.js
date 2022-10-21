import Element, { Fragment, Inline } from './ui/Element'

const jsx = (type, props, key) => type === Fragment
    ? props.children
    : new Element(type, props, key)

export {Fragment, Inline, jsx, jsx as jsxs }