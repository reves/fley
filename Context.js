import { wipFiber } from './Renderer'

export default function Context(initial) {

    const context = {
        value: initial
    }

    function setValue(newValue) {
        context.value = newValue
    }

    return [context.value, setValue]
}

export function watch(context) {

    // subscribe the component
    
}
