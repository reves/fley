export function getCookie(name) {
    if (!name) return ''
    return document.cookie.replace(
        new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1'
    )
}

export function is(x, y) {
    return (
        (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y)
    )
}

export function same(prev, next) {
    return prev && prev.length === next.length && prev.every((p, i) => is(p, next[i]))
}

export function getMethods(ClassName) {
    const methods = []
    let prototype = ClassName.prototype
    while (prototype.constructor !== Object) {
        methods.push(...Object.getOwnPropertyNames(prototype))
        prototype = Object.getPrototypeOf(prototype)
    }
    return methods.filter(m => m !== 'constructor')
}
