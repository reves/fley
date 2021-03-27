import render from './container/render'
import Component from './container/types/Component'

export default function (rootElementId, container) {

    const rootElement = document.getElementById(rootElementId)
    const rootContainer = new Component(() => container)

    render(rootContainer, rootContainer.node = document.createDocumentFragment())
    rootElement.innerHTML = ''
    rootElement.appendChild(rootContainer.node)
    
}
