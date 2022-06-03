import { getCookie } from './utils'

export class Api {

    constructor(options) {
        this.baseURL = ''
        this.responseType = 'json'
        this.CSRFCookie = ''
        this.headers = {}
        this.timeout = 5000
        options && this.init(options)
    }

    init(options = {}) {
        for (const prop in options) {
            this[prop] = options[prop]
        }
    }

    get(endpoint, params = {}) {
        let query = ''
        for (let key in params) query += key + '=' + encodeURIComponent(params[key]) + '&'
        query &&= '?' + query.replace(/&$/, '')
        return this.request('GET', endpoint + query)
    }

    post(endpoint, data = {}) {
        const form = new FormData()
        for (const key in data) data.append(key, data[key])
        return this.request('POST', endpoint, form)
    }

    request(method, endpoint, body) {
        const xhr = new XMLHttpRequest()
        xhr.open(method, this.baseURL + endpoint, true)
        xhr.responseType = this.responseType
        xhr.timeout = this.timeout
        for (const name in this.headers) xhr.setRequestHeader(name, this.headers[name])
        if (method === 'POST' && this.CSRFCookie) {
            xhr.setRequestHeader("X-CSRF-Token", getCookie(this.CSRFCookie))
        }
        xhr.send(body)
        return new XHRHandler(xhr)
    }
}

function XHRHandler(xhr) {
    
    const error = e => this.error && this.error(xhr.response, xhr.status, e)
    xhr.onerror = xhr.ontimeout = error
    xhr.onprogress = e => this.progress && this.progress(e)
    xhr.onloadend = e => this.always && this.always(xhr.response, xhr.status, e)
    xhr.onload = e => xhr.status >= 200 && xhr.status <= 299
        ? this.success && this.success(xhr.response, xhr.status, e)
        : xhr.status >= 400 && xhr.status <= 499
            ? this.fail && this.fail(xhr.response, xhr.status, e)
            : error(e)

    this.progress = callback => {
        this.progress = callback
        return this
    }

    this.success = callback => {
        this.success = callback
        return this
    }

    this.fail = callback => {
        this.fail = callback
        return this
    }

    this.error = callback => {
        this.error = callback
        return this
    }

    this.always = callback => {
        this.always = callback
        return this
    }

    this.abort = () => xhr.abort()
}

export default new Api()