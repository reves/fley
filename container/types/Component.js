import normalize from '../normalize'
import reconcile from '../reconcile'

export let currentComponent = null

export default class Component
{
    constructor(origin, props, previousStates = []) {

        this.previousStates = previousStates
        this.states = []
        this.childKeys = []

        currentComponent = this
        this.children = origin(props)
        this.previousStates = null
        currentComponent = null

        this.update = () => reconcile(this, new Component(origin, props, this.states))

        normalize(this)

    }

}
