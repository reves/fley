export function getCookie(name) {
    return document.cookie.replace(
        new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1'
    )
}

export function is(x, y) {
    return (
        (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y)
    )
}

export function getMethodsNames(Class) {
    const names = []
    let prototype = Class.prototype
    while (prototype.constructor !== Object) {
        names.push(...Object.getOwnPropertyNames(prototype))
        prototype = Object.getPrototypeOf(prototype)
    }
    return names.filter(n => n !== 'constructor')
}
