import Component from './types/Component'

export default function unwatch(container) {

    if (container instanceof Array) return container.forEach(item => unwatch(item))
    if (container instanceof Component) return unwatch(container.component)
    if (!container.dynamic) return

    container.watching.forEach(state => {
        const index = state._watchers.indexOf(container)
        if (index === -1) return
        state._watchers.splice(index, 1)
    })

    unwatch(container.children)
}
