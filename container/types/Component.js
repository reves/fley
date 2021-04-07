import normalize from '../normalize'
import reconcile from '../reconcile'
import clone from '../clone'

export let currentComponent = null

export default class Component
{
    constructor(origin, props, key, previousComponent) {

        if (!previousComponent && props && props.children) {
            const children = props.children
            props.children = () => clone(children)
        }

        this.previousComponent = previousComponent
        this.states = []
        this.watching = []
        this.childKeys = []
        this.key = key
        this.props = props
        this.origin = origin
        currentComponent = this
        this.children = origin(props)
        this.previousComponent = null
        currentComponent = null

        this.update = (newProps = props, newKey = key) => {

            const updatedComponent = new Component(origin, newProps, newKey, this)

            reconcile(this, updatedComponent)

            this.states = updatedComponent.states
            this.watching = updatedComponent.watching
            this.childKeys = updatedComponent.childKeys
        }

        normalize(this)

    }

}
