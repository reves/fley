import { statesWatchers } from './../State'
import Component from './types/Component'

export default function unwatch(container) {

    if (container instanceof Array) return container.forEach(item => unwatch(item))
    if (!(container instanceof Component) && !container.dynamic) return

    container.watching.forEach(state => {
        const watchers = statesWatchers.get(state)
        const index = watchers.indexOf(container)
        if (index === -1) return
        watchers.splice(index, 1)
    })

    if (container instanceof Component) return unwatch(container.component)
    unwatch(container.children)
}
