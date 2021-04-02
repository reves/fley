import normalize from '../normalize'

/* export let currentComponent = null
export let previousComponent = null

export function setPreviousComponent(component) {
    return previousComponent = component
} */
window.components = []
export default class Component
{
    constructor(origin, props) {
        window.components.push(this)
        // currentComponent = this

        // this.watching = []
        // this.states = []
        this.children = origin(props)
        this.origin = origin
        this.props = props
        this.childKeys = []

        normalize(this)
    }

}
