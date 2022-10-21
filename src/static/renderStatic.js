import Fiber, { isReserved } from '../ui/Fiber'
import Element, { Text } from '../ui/Element'
import { update } from '../ui/renderer'
import router from '../stores/router'
import head from '../ui/head'

const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']

function Route(regex, dom) {
    this.regex = regex
    this.dom = dom
}

function RouteRegex(source, flags) {
    this.source = source
    this.flags = flags
}

function RouteDOM(head, root) {
    this.title = titleToString(head.title)
    this.meta = metaToString(head.meta)
    this.schema = schemaToString(head.schema)
    this.content = rootToString(root)
}

export default function renderStatic(children) {
    const routes = { ...router.routes, '': new RegExp }
    for (const name in routes) {
        router.name = name
        const routeRegex = routes[name]
        const [root, reset] = update(new Fiber(new Element(null, { children })))
        routes[name] = new Route(
            new RouteRegex(routeRegex.source, routeRegex.flags),
            new RouteDOM(head, root)
        )
        reset()
    }
    return routes
}

function rootToString(root) {
    let result = ''
    root.walkDepth((fiber) => {
        if (fiber.isComponent || fiber === root) return
        if (fiber.type === Text) {
            result += escape(fiber.props.value)
            return
        }
        if (fiber.props.hasOwnProperty('html')) {
            result += fiber.type.replace(/^(<\w+)/, `$1${propsToString(fiber)}`)
            return
        }
        if (voidElements.indexOf(fiber.type) !== -1) return
        result += `</${fiber.type}>`
    }, (fiber) => {
        if (fiber.isComponent || fiber === root) return
        if (fiber.type === Text || fiber.props.hasOwnProperty('html')) return
        result += `<${fiber.type}${propsToString(fiber)}>`
    })
    return result
}

function propsToString(fiber) {
    let result = ''
    const props = fiber.props
    for (const prop in props) {
        if (isReserved(prop)) continue
        if (prop === 'ref') continue
        if (/^on.+/i.test(prop)) continue
        const value = props[prop]
        if (typeof value === 'boolean' && value) {
            result += ` ${prop}`
        } else if (value != null) {
            result += ` ${prop}="${escape(value)}"`
        }
    }
    return result
}

function titleToString(title) {
    return `<title>${escape(title)}</title>`
}

function metaToString(meta) {
    let result = ''
    for (const props of meta) {
        result += '<meta'
        for (const prop in props) result += ` ${prop}="${escape(props[prop])}"`
        result += '>'
    }
    return result
}

function schemaToString(schema) {
    return schema
        ? '<script type="application/ld+json">'
            + JSON.stringify(schema, (_, v) => typeof v === 'object' ? v : escape(v))
            + '</script>'
        : ''
}

function escape(value) {
    return ('' + value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27")
        .replace(/`/g, "&#x60;")
}