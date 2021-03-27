import { statesWatchers } from './../State'

export default function watch(container) {

    container.watching.forEach(state => statesWatchers.get(state).push(container))

}
