import normalize from '../normalize'

export let currentComponent = null
export let previousComponent = null

export function setPreviousComponent(component) {
    return previousComponent = component
}

export default class Component
{
    constructor(origin, props) {

        currentComponent = this

        this.watching = []
        this.states = []
        this.component = origin(props)
        this.props = props
        this.childKeys = []
        this.origin = origin

        normalize(this)
    }

}
