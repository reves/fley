import Renderer from './Renderer'

export let renderer = null

export default function(rootElementId, children) {

    const rootElement = document.getElementById(rootElementId)
    rootElement.innerHTML = ''

    renderer = new Renderer(rootElement, children)

    window.upd = () => renderer.dispatchUpdate(window.rootFiber) // debug

}
