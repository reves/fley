export const isFunction = (v) => typeof v === 'function'
export const isBool = (v) => typeof v === 'boolean'
export const isObject = (v) => typeof v === 'object'
export const isString = (v) => typeof v === 'string'
export const isNum = (v) => typeof v === 'number'
export const isUndefined = (v) => v === undefined
export const isArray = (v) => Array.isArray(v)
export const isValueRef = (v) => !!v._watch
export const isPlaceholder = (v) => isFunction(v) && v._getPlaceholder
export const defineProperty = (o, p, d) => Object.defineProperty(o, p, d)
export const getOwnProperties = (o) => Object.getOwnPropertyNames(o)
export const seal = (o) => Object.seal(o)

export const isBrowser =
    typeof window !== 'undefined' && typeof window.document !== 'undefined'

export function getCookie(name) {
    return name ? document.cookie.replace(
        new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1'
    ) : ''
}