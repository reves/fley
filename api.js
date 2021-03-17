function get(endpoint, params) {

    let encodedParams = '?'

    if (params) {
        for (let param in params) encodedParams += param + '=' + encodeURIComponent(params[param]) + '&'
        encodedParams = encodedParams.slice(0, -1)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('GET', endpoint + encodedParams, true)
    xhr.responseType = 'json'
    xhr.timeout = 5000
    xhr.send()

    return new EventSetter(xhr)

}

function post(endpoint, fields) {

    const data = new FormData()

    if (fields) {
        for (let name in fields) data.append(name, fields[name])
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint, true)
    xhr.responseType = 'json'
    xhr.timeout = 5000
    xhr.setRequestHeader('X-CSRF-Token', document.cookie.replace(new RegExp('(?:(?:^|.*;\\s*)' + 'csrftoken' + '\\s*\\=\\s*([^;]*).*$)|^.*$'), '$1'))
    xhr.send(data)

    return new EventSetter(xhr)

}

function EventSetter(xhr) {

    let onSuccess, onFail, onError, doAlways

    const errorHandler = () => { onError && onError(xhr.response, xhr.status) }

    xhr.addEventListener('abort', errorHandler)
    xhr.addEventListener('timeout', errorHandler)
    xhr.addEventListener('error', errorHandler)
    xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status <= 299 ) return onSuccess && onSuccess(xhr.response, xhr.status)
        if (xhr.status == 400) return onFail && onFail(xhr.response, xhr.status)
        errorHandler()
    })
    xhr.addEventListener('loadend', () => { doAlways && doAlways(xhr.response, xhr.status) })

    this.success = function(callback) {
        onSuccess = callback
        return this
    }

    this.fail = function(callback) {
        onFail = callback
        return this
    }

    this.error = function(callback) {
        onError = callback
        return this
    }

    this.always = function(callback) {
        doAlways = callback
        return this
    }

}

export default {
    get,
    post
}
