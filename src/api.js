import { getCookie } from './utils'

let _promise = null

function Response(request) {
    this.data = request.response
    this.status = request.status
}

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
        for (const prop in options) this[prop] = options[prop]
    }

    get(endpoint, params = {}) {
        let query = ''
        for (let key in params) query += key
            + '=' + encodeURIComponent(params[key]) + '&'
        query &&= '?' + query.replace(/&$/, '')
        return this.request('GET', endpoint + query)
    }

    post(endpoint, data = {}) {
        const form = new FormData()
        for (const key in data) {
            if (data[key] instanceof FileList) {
                for (const file of data[key]) form.append(key + '[]', file)
                continue
            }
            form.append(key, data[key])
        }
        return this.request('POST', endpoint, form)
    }

    request(method, endpoint, body) {
        const URL = (endpoint[0] === '/' && endpoint[1] !== '/')
            ? this.baseURL + endpoint
            : endpoint

        // Setup XHR
        const xhr = new XMLHttpRequest()
        xhr.open(method, URL)
        xhr.responseType = this.responseType
        xhr.timeout = this.timeout
        for (const name in this.headers) xhr.setRequestHeader(name, this.headers[name])
        if (method === 'POST' && this.CSRFCookie) {
            xhr.setRequestHeader("X-CSRF-Token", getCookie(this.CSRFCookie))
        }
        xhr.send(body)

        // Get the current Promise
        const promise = _promise ?? createPromise(this)
        promise._requests.push(xhr)

        // Handle completion
        xhr.onloadend = _ => {
            promise._requestsCompleted++
            const reqs = promise._requests
            const requestsNum = reqs.length
            if (requestsNum !== promise._requestsCompleted) return

            // All requests completed
            const handler = promise._requestsHandler 
            if (promise._aborted) return handler.always?.call()

            let result = null // returned value from handler
            let responses = new Array(requestsNum)
            const successful = new Array(requestsNum)
            const failed = new Array(requestsNum)
            let erroneous = new Array(requestsNum)
            const failedAndErroneous = new Array(requestsNum)
            let successfulNum = 0
            let failedNum = 0
            let erroneousNum = 0

            for (let i=0; i<requestsNum; i++) {
                const request = reqs[i]
                const response = new Response(request)
                responses[i] = response
                switch (true) {
                    case (response.status >= 200 && response.status <= 299):
                        successful[i] = response.data
                        successfulNum++
                        continue
                    case (response.status >= 400 && response.status <= 499):
                        failed[i] = failedAndErroneous[i] = response
                        failedNum++
                        continue
                }
                erroneous[i] = failedAndErroneous[i] =  response
                erroneousNum++
            }

            // fail
            if (failedNum) {
                if (handler.fail) {
                    handler.fail.apply(null, failed)
                } else {
                    // pass to error handler
                    erroneous = failedAndErroneous
                    erroneousNum += failedNum
                }
            }

            // error
            if (erroneousNum) handler.error?.apply(null, erroneous)

            // success
            if (successfulNum) result = handler.success?.apply(null, successful)

            // always
            const resp = responses.length > 1 ? responses : responses[0]
            if (handler.always) {
                const _result = handler.always.apply(null, responses)
                result ??= _result
            } else if (erroneousNum && !handler.error) {
                // reject if any unhandled errors
                return promise._reject(resp)
            }

            promise._resolve(result ?? resp)
        }

        return promise
    }
}

function createPromise(api) {
    let resolve, reject = null
    const reqs = []
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    promise._resolve = resolve
    promise._reject = reject
    promise._requestsCompleted = 0
    promise._requests = reqs

    // Requests handler
    const handler = {
        success: null,
        fail: null,
        error: null,
        always: null
    }
    promise._requestsHandler = handler
    promise.success = fn => (handler.success = fn) && promise
    promise.fail = fn => (handler.fail = fn) && promise
    promise.error = fn => (handler.error = fn) && promise
    promise.always = fn => (handler.always = fn) && promise
    promise.progress = fn => (reqs[reqs.length-1].onprogress = fn) && promise
    promise.abort = _ => {
        promise._aborted = true
        for (const r of reqs) r.abort()
    }

    // Wrap Api methods
    for (const m of ['get', 'post', 'request']) {
        promise[m] = function() {
            _promise = promise
            api[m].apply(api, arguments)
            _promise = null
            return promise
        }
    }

    return promise
}

export default new Api()
