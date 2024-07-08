import { createStore } from '../ui/hooks'
import { isBrowser } from '../utils'

class Router {

    static initialized = false
    static goCallback = null

    constructor() {
        this.routes = {}
        this.name = ''
        this.path = '/'
        this.params = {}
        this.query = {}
        this.hash = ''
        this.from = ''
    }

    define(routes = {}, settings = {}) {
        if (isBrowser && !Router.initialized) {
            try { window.history.replaceState({}, '', window.location.href) } catch(error) {}
            window.addEventListener('popstate', _ => router.go(window.location.pathname))
            document.addEventListener('click', onRelativeLinkClick)
            Router.initialized = true
        }
        this.routes = routes
        Router.goCallback = settings.goCallback
        isBrowser && this.go(window.location.pathname)
    }

    go(path, cb) {
        path = path[0] === '/' ? path : ('/' + path)
        if (path !== window.location.pathname) {
            window.history.pushState({}, '', path)
        }
        this.path = window.location.pathname
        this.hash = window.location.hash
        this.from = this.name
        this.name = ''
        this.params = {}
        for (const name in this.routes) {
            const result = this.path.match(this.routes[name])
            if (result && result.shift() === this.path) {
                this.name = name
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
        cb = cb || Router.goCallback
        cb && cb()
    }
}

function onRelativeLinkClick(e) {
    if (e.defaultPrevented
        || e.button !== 0
        || e.ctrlKey
        || e.metaKey
        || e.altKey
        || e.shiftKey
    ) return

    let element = e.target
    while (element 
        && !(element instanceof HTMLAnchorElement 
            || element instanceof HTMLAreaElement)
    ) element = element.parentElement

    if (!element 
        || (element.hasAttribute('target') 
            && element.getAttribute('target').trim() !== '_self')
    ) return

    let href = element.getAttribute('href')
    if (!href) return e.preventDefault()
    if (href[0] !== '/') return
    if (href.length > 1 && href[href.length - 1] === '/') {
        href = href.substring(0, href.length - 1)
    }

    e.preventDefault()
    router.go(href)
    return false
}

const router = createStore(Router)

export default router
