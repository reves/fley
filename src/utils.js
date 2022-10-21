export const isBrowser = typeof window !== "undefined"
    && typeof window.document !== "undefined"

export function getCookie(name) {
    if (!name) return ''
    return document.cookie.replace(
        new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1'
    )
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