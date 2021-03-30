import normalize from '../normalize'

export default class Element
{
    constructor(type, props, key) {

        this.type = type
        this.attributes = { static: {}, dynamic: {} }
        this.node = null
        this.key = key
        this.html = null // innerHTML
        this.children = []
        this.childKeys = []
        this.eventListeners = {}
        this.watching = []
        this.prevDependencies = null
        this.getDependencies = null
        this.onUpdate = null
        this.dynamic = false

        if (props) {

            for (let prop in props) {

                // Reserved props
                switch (prop) {

                    case 'html':
                        if (typeof props[prop] === 'function') this.dynamic = true
                        this.html = props[prop]
                        continue

                    case 'watch':
                        (props[prop] instanceof Array) ? this.watching = props[prop] : this.watching.push(props[prop])
                        continue

                    case 'only':
                        this.getDependencies = props[prop]
                        if (typeof props[prop] !== 'function') continue
                        this.prevDependencies = this.getDependencies()
                        this.prevDependencies = (this.prevDependencies instanceof Array) ? this.prevDependencies : [this.prevDependencies]
                        continue

                    case 'onUpdate':
                        this.onUpdate = props[prop]
                        continue

                    case 'children':
                        this.children = props[prop]
                        continue
                }

                // Static attributes
                if (typeof props[prop] !== 'function') {
                    this.attributes.static[prop] = props[prop]
                    continue
                }

                // Event listeners
                if (prop.substring(0, 2) === 'on') {
                    const eventType = prop.substring(2).toLowerCase()
                    if (!eventType) continue
                    this.eventListeners[eventType] = props[prop]
                    continue
                }

                // Dynamic attributes
                this.attributes.dynamic[prop] = props[prop]
                this.dynamic = true

            }
        }
        normalize(this)
    }

}
