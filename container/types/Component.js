import normalize from '../normalize'

export default class Component
{
    constructor(origin, props) {
        this.component = origin(props)
        this.props = props
        this.childKeys = []
        this.origin = origin

        normalize(this)
    }

}
