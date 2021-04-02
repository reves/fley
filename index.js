import render from './container/render'
import update from './container/update'

export default function(rootElementId, container) {

    const rootElement = document.getElementById(rootElementId)
    const fragment = document.createDocumentFragment()

    rootElement.innerHTML = ''
    render(container, fragment)
    rootElement.appendChild(fragment)

    window.ley = container.children ?? container // Debug
    console.log('ley:', window.ley) // Debug

    /* setTimeout(() => {
        console.log('Updating!')
        // update(container)
        update(window.components[0])
    }, 1050) */
    /* setInterval(() => {
        console.log('Updating!')
        // update(container)
        update(window.components[0])
    }, 1050) */

}
