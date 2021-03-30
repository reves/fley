import render from './container/render'

export default function (rootElementId, container) {

    const rootElement = document.getElementById(rootElementId)
    const fragment = document.createDocumentFragment()
window.ley = container
    render(container, fragment)
    rootElement.innerHTML = ''
    rootElement.appendChild(fragment)
    
}
