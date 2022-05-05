import { createStore } from './ui/hooks'

/**
 * TODO:
 * - onGo event (e.g. scroll to top App wrapper)
 * - actions: change title, meta tags
 * - dummy url (e.g. /search) - ?
 */

class Router {

    static routes = {}

    constructor() {
        this.name = ''
        this.path = ''
        this.params = {}
        this.query = {}
        this.hash = ''
        this.redirectedFrom = ''
    }

    go(path) {
        if (path !== window.location.pathname){
            window.history.pushState({}, '', path)
        }
        Router.matchRoute.call(this, path)
    }

    define(newRoutes = {}) {
        this.routes = newRoutes
        Router.matchRoute.call(this, window.location.pathname)
    }

    static matchRoute(path) {
        this.redirectedFrom = this.name
        this.name = ''
        this.path = path
        this.params = {}
        this.query = Object.fromEntries(new URLSearchParams(window.location.search))
        this.hash = window.location.hash
        for (let route in this.routes) {
            const result = path.match(this.routes[route])
            if (result && result.shift() === path) {
                this.name = route
                this.params = result.groups || {}
                return
            }
        }
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