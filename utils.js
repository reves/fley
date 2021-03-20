export function getCookie(name) {
    return document.cookie.replace(new RegExp('(?:(?:^|.*; *)' + name + '=([^;]*).*$)|^.*$'), '$1')
}
