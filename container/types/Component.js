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

        this.update = () => {

            const updatedComponent = new Component(origin, props, this.states)

            reconcile(this, updatedComponent)

            this.states = updatedComponent.states
            this.children = updatedComponent.children
            this.childKeys = updatedComponent.childKeys
        }

        normalize(this)

    }

}
