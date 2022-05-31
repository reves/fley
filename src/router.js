import { createStore } from './ui/hooks'

class Router {

    static routes = {}

    constructor() {
        this.name = ''
        this.path = '/'
        this.params = {}
        this.query = {}
        this.hash = ''
        this.from = ''
    }

    define(routes = {}) {
        Router.routes = routes
        this.go(window.location.pathname)
    }

    go(path, cb) {
        path = path[0] === '/' ? path : ('/' + path)
        if (path !== window.location.pathname){
            window.history.pushState({}, '', path)
        }
        this.path = path
        this.hash = window.location.hash
        this.from = this.name
        this.name = ''
        this.params = {}
        for (let route in Router.routes) {
            const result = path.match(Router.routes[route])
            if (result && result.shift() === path) {
                this.name = route
                this.params = result.groups || {}
                break
            }
        }
        this.query = window.location.search
            ? window.location.search.slice(1).split('&')
                .reduce((params, param) => {
                    const [key, value] = param.split('=')
                    params[key] = value
                        ? decodeURIComponent(value.replace(/\+/g, ' '))
                        : '';
                    return params
                }, {})
            : {}
        cb && cb()
    }
}

const router = createStore(Router)

export function setTitle(title = '') {
    document.title = title
}

const metaNodes = []

export function setMeta(meta = []) {
    metaNodes.forEach(node => document.head.removeChild(node))
    metaNodes.length = 0
    if (!meta.length) return
    const fragment = document.createDocumentFragment()
    meta.forEach(props => {
        const node = document.createElement('meta')
        for (const prop in props) node.setAttribute(prop, props[prop])
        metaNodes.push(node)
        fragment.appendChild(node)
    })
    document.head.appendChild(fragment)
}

let schemaNode = null

export function setSchema(schema = '') {
    if (!schemaNode) {
        schemaNode = document.createElement('script')
        schemaNode.type = 'application/ld+json'
        document.head.appendChild(schemaNode)
    }
    schemaNode.text = typeof schema === 'object'
        ? JSON.stringify(schema)
        : schema
}

// Set the initial window history state
try { window.history.replaceState({}, '', window.location.href) } catch(error) {}

// Listen for popstate events
window.addEventListener('popstate', () => router.go(window.location.pathname))

// Listen for click events on relative path links
document.addEventListener('click', event => {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey || 
        event.metaKey || 
        event.altKey || 
        event.shiftKey
    ) {
        return
    }

    let element = event.target
    while (element && 
        !(
            element instanceof HTMLAnchorElement || 
            element instanceof HTMLAreaElement
        )
    ) {
        element = element.parentElement
    }

    if (!element || 
        (
            element.hasAttribute('target') && 
            element.getAttribute('target').trim() !== '_self'
        )
    ) {
        return
    }

    let href = element.getAttribute('href')
    if (!href) return event.preventDefault()
    if (href[0] !== '/') return
    if (href.length > 1 && href[href.length - 1] === '/') {
        href = href.substring(0, href.length - 1)
    }

    event.preventDefault()
    router.go(href)
    return false
})

export default router