import { createStore } from './ui/hooks'

/**
 * TODO:
 * - actions: change title, meta tags
 * - close, when going back (e.g. close modal window)
 */

class Router {

    static routes = {}

    constructor() {
        this.name = ''
        this.path = '/'
        this.params = {}
        this.query = {}
        this.hash = ''
        this.redirectedFrom = ''
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
        this.redirectedFrom = this.name
        this.name = ''
        this.path = path
        this.params = {}
        this.query = Object.fromEntries(new URLSearchParams(window.location.search))
        this.hash = window.location.hash
        for (let route in Router.routes) {
            const result = path.match(Router.routes[route])
            if (result && result.shift() === path) {
                this.name = route
                this.params = result.groups || {}
                break
            }
        }
        cb && cb()
    }
}

const router = createStore(Router)

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