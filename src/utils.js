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
