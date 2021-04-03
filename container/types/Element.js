import normalize from '../normalize'

export default class Element
{
    constructor(type, props, key) {

        this.type = type
        this.node = null
        this.children = []
        this.attributes = {}
        this.eventListeners = {}
        this.key = key
        this.childKeys = []
        this.html = null

        for (let prop in props) {

            // Reserved props
            switch (prop) {

                case 'html':
                    this.html = (typeof props[prop] === 'function') ? props[prop]() : props[prop]
                    continue

                case 'children':
                    this.children = props[prop]
                    continue
            }

            // Event listeners
            if (/^on.+/i.test(prop)) {
                this.eventListeners[prop.toLowerCase()] = props[prop]
                continue
            }

            // Attributes
            switch (typeof props[prop]) {
                case 'function':
                    props[prop] = props[prop]()
                    if (typeof props[prop] === 'boolean') {
                        if (props[prop]) this.attributes[prop] = ''
                        continue
                    }
                    if (props[prop] != null) this.attributes[prop] = props[prop]
                    continue
                
                case 'boolean':
                    if (props[prop]) this.attributes[prop] = ''
                    continue

                default:
                    if (props[prop] != null) this.attributes[prop] = props[prop]
                    continue
            }

        }

        normalize(this)

    }

}
