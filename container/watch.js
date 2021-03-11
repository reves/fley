export default function watch(container) {

    container.watching.forEach(state => state._watchers.push(container))

}
