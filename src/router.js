import State from './State'

let routes = {}

const [router, setState] = State({
    name: '',
    path: '',
    params: {},
    query: {},
    hash: '',
    redirectedFrom: ''
})

router.go = function(path) {
    if (path === window.location.pathname) return setState() // Force components update
    window.history.pushState({}, '', path)
    matchRoute(path)
}

router.define = function(newRoutes = {}) {
    routes = newRoutes
    matchRoute(window.location.pathname)
}

function matchRoute(path) {

    let name = ''
    let params = {}

    for (let route in routes) {

        const result = path.match(routes[route])

        if (result && result.shift() === path) {
            name = route
            params = result.groups || {}
            break
        }
    }

    setState({
        name,
        path,
        params,
        query: Object.fromEntries(new URLSearchParams(window.location.search)),
        hash: window.location.hash,
        redirectedFrom: router.name
    })

}

// Set the initial window history state
try { window.history.replaceState({}, '', window.location.href) } catch(error) {}

// Listen for popstate events
window.addEventListener('popstate', () => matchRoute(window.location.pathname))

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

    while (element && !(element instanceof HTMLAnchorElement || element instanceof HTMLAreaElement)) {
        element = element.parentElement
    }

    if (!element || (element.hasAttribute('target') && element.getAttribute('target').trim() !== '_self')) {
        return
    }

    let href = element.getAttribute('href')

    if (!href) return event.preventDefault()
    if (href[0] !== '/') return
    if (href.length > 1 && href[href.length - 1] === '/') href = href.substring(0, href.length - 1)

    event.preventDefault()
    router.go(href)

    return false
})

export default router
