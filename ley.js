import render from './container/render'
import Component from './container/types/Component'

export default function ley(rootElementId, container) {

    // console.time('RENDER') // DEBUG

    const rootElement = document.getElementById(rootElementId)
    const rootContainer = new Component(() => container)

    render(rootContainer, rootContainer.node = document.createDocumentFragment())
    rootElement.innerHTML = ''
    rootElement.appendChild(rootContainer.node)

    // console.timeEnd('RENDER') // DEBUG
    // window.ley = rootContainer.component; // DEBUG
    // console.log('Container:', window.ley) // DEBUG

}
