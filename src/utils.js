export const isBrowser = typeof window !== "undefined"
    && typeof window.document !== "undefined"

export function getCookie(name) {
    return name ? document.cookie.replace(
        new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1'
    ) : ''
}