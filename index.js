import render from './container/render'

export default function(rootElementId, container) {

    const rootElement = document.getElementById(rootElementId)
    const fragment = document.createDocumentFragment()

    rootElement.innerHTML = ''
    render(container, fragment)
    rootElement.appendChild(fragment)

    window.ley = container.children ?? container // Debug
    console.log('ley:', window.ley) // Debug

}
