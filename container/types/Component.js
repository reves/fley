import normalize from '../normalize'

/* export let currentComponent = null
export let previousComponent = null

export function setPreviousComponent(component) {
    return previousComponent = component
} */
window.components = [] // Debug
export default class Component
{
    constructor(origin, props) {
        window.components.push(this) // Debug
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
