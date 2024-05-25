import { createRoot, isReserved } from '../ui/Fiber'
import { Text, Inline } from '../ui/Element'
import { update } from '../ui/renderer'
import router from '../stores/router'
import i18n, { getLocales } from '../stores/i18n'
import { title, schema, meta } from '../ui/head'
import { isBool, isFunction, isPlaceholder, isString } from '../utils'

const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']
const placeholders = new Set()

function RouteDOM(root) {
    this.title = titleToString(title?.next)
    this.meta = metaToString(meta?.next)
    this.schema = schemaToString(schema?.next)
    this.content = rootToString(root)
    this.placeholders = Array.from(placeholders)
    placeholders.clear()
}

export default function renderStatic(children) {
    const routes = { ...router.routes, "": new RegExp }
    const locales = getLocales().map(([code, _]) => code)

    for (const name in routes) {
        router.name = name
        const regex = routes[name]
        let dom = {}

        if (locales.length) {
            for (const locale of locales) {
                if (!i18n.setLocale(locale)) continue
                const fiber = createRoot(children)
                fiber.sync = true
                const [root, reset] = update(fiber)
                dom[locale] = new RouteDOM(root)
                reset()
            }
        } else {
            const fiber = createRoot(children)
            fiber.sync = true
            const [root, reset] = update(fiber)
            dom = new RouteDOM(root)
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
            if (fiber === root) return
            if (fiber.isComponent) {
                const getPlaceholder = fiber.type._getPlaceholder
                if (getPlaceholder) {
                    result += `<!---->${getPlaceholder()}<!---->`
                    placeholders.add(getPlaceholder())
                }
                return
            }
            if (fiber.type === Text) {
                result += escape(fiber.props.value)
                return
            }
            if (fiber.type === Inline) {
                result += fiber.props.html.replace(/^(<\w+)/, `$1${propsToString(fiber)}`)
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
        if (isReserved(prop) || prop === 'ref' || /^on.+/i.test(prop)) continue
        const value = props[prop]
        if (isFunction(value)) {
            const getPlaceholder = value._getPlaceholder
            if (getPlaceholder) {
                result += ` ${prop}="${getPlaceholder()}"`
                placeholders.add(getPlaceholder())
            }
            continue
        }
        if (value == null) continue
        if (isBool(value)) {
            if (value) result += ` ${prop}`
            continue
        }
        result += ` ${prop}="${escape(value)}"`
    }
    return result
}

function titleToString(title) {
    if (!title) return ''
    if (isPlaceholder(title)) {
        title = title._getPlaceholder()
        placeholders.add(title)
    } else {
        title = escape(title)
    }
    return `<title>${title}</title>`
}

function metaToString(meta) {
    let result = ''
    for (const props of meta) {
        result += '<meta'
        for (const attr in props) {
            let value = props[attr]
            if (isPlaceholder(value)) {
                value = value._getPlaceholder()
                placeholders.add(value)
            } else value = escape(props[attr])
            result += ` ${attr}="${value}"`
        }
        result += '>'
    }
    return result
}

function schemaToString(schema) {
    if (!schema) return ''
    if (isPlaceholder(schema)) {
        schema = schema._getPlaceholder()
        placeholders.add(schema)
    } else {
        schema = JSON.stringify(schema, (_, v) => isString(v) ? escape(v) : v)
    }
    return `<script type="application/ld+json">${schema}</script>`
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
