import Fiber, { isReserved } from '../ui/Fiber'
import Element, { Text } from '../ui/Element'
import { update, setSyncOnly } from '../ui/renderer'
import router from '../stores/router'
import i18n, { getLocales } from '../stores/i18n'
import head from '../ui/head'
import { isObject } from '../utils'

const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']

export default function renderStatic(children) {

    function RouteDOM(head, root) {
        this.title = titleToString(head.title)
        this.meta = metaToString(head.meta)
        this.schema = schemaToString(head.schema)
        this.content = rootToString(root)
    }
    const routes = { ...router.routes, "": new RegExp }
    const locales = getLocales().map(([code, _]) => code)

    setSyncOnly()

    for (const name in routes) {
        router.name = name
        const regex = routes[name]
        let dom = {}

        if (locales.length) {
            for (const locale of locales) {
                if (!i18n.setLocale(locale)) continue
                const [root, reset] = update(new Fiber(new Element(null, { children })))
                dom[locale] = new RouteDOM(head, root)
                reset()
            }
        } else {
            const [root, reset] = update(new Fiber(new Element(null, { children })))
            dom = new RouteDOM(head, root)
            reset()
        }

        routes[name] = {
            regex: { source: regex.source, flags: regex.flags },
            dom
        }
    }

    console.log(JSON.stringify(routes))
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
        }
    )
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
            + JSON.stringify(schema, (_, v) => isObject(v) ? v : escape(v))
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