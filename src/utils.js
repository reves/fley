const _Object = Object
export const isFunction = (v) => typeof v === 'function'
export const isObject = (v) => typeof v === 'object'
export const isUndefined = (v) => v === undefined
export const defineProperty = (o, p, d) => _Object.defineProperty(o, p, d)
export const getOwnProperties = (o) => _Object.getOwnPropertyNames(o)
export const seal = (o) => _Object.seal(o)

export const isBrowser =
    typeof window !== 'undefined' && typeof window.document !== 'undefined'

export function getCookie(name) {
    return name ? document.cookie.replace(
        new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1'
    ) : ''
}