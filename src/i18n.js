import { getCookie } from './utils'
import { createStore } from './ui/Hooks'

class I18n {

    static locales = {}
    static fallbackLocale = {}

    constructor() {
        this.code = ''
        this.locale = {}
        this.plural = null
    }

    define(locales = {}) {
        I18n.locales = locales

        // The fallback locale will be the first defined in the locales object
        let fallbackCode = ''
        for (const key in locales) {
            I18n.fallbackLocale = locales[key]
            fallbackCode = key
            break
        }

        // Detect locale from the cookie
        if (this.setLocale(getCookie('lang'))) return

        // Detect locale from the browser
        if (this.setLocale(navigator.language)) return

        // Use the fallback locale
        this.setLocale(fallbackCode)
    }

    setLocale(code) {
        if (this.code === code) return null
        if (!I18n.locales.hasOwnProperty(code)) return null
        document.cookie = 'lang=' + code + ';path=/;max-age=31536000;secure;samesite=Lax'
        document.documentElement.setAttribute('lang', code)
        this.code = code
        this.locale = I18n.locales[code]
        this.plural = this.locale.$?.plural ?? (n => n == 1 ? 0 : 1)
        return true
    }
}

const i18n = createStore(I18n)

export function t(key, substitute = null) {
    const prefix = key.replace(/\.?[^\.]*$/, '')
    const fallbackKey = prefix ? prefix + '._' : '_'
    let value = getValue(key, i18n.locale) ||
                getValue(fallbackKey, i18n.locale) ||
                getValue(key, I18n.fallbackLocale) || 
                getValue(fallbackKey, I18n.fallbackLocale)
    if (!value) return ''
    return interpolate(
        value.replace( // resolve references
            /\@\{([^\}]*)\}/g,
            (_, $1) => $1.charAt(0) === '.' ? t(prefix + $1) : t($1)
        ),
        substitute
    )
}

function getValue(path, object) {
    return path 
        ? path.split('.').reduce((o, k) => o[k] ?? '', object)
        : null
}

function interpolate(template, substitute, tag) {
    if (!template) return ''
    if (substitute == null) return template

    const type = typeof substitute
    let regExp, replacer

    switch (true) {
        case type === 'string':
            regExp = new RegExp('\\{' + (tag ?? 's') + '\\}', 'g')
            replacer = substitute
            break

        case type === 'boolean':
            regExp = new RegExp('\\{' + (tag ?? 'b') + '\\:([^\\}]*)\\|\\|([^\\}]*)\\}', 'g')
            replacer = (_, $1, $2) => substitute ? $1.trim() : $2.trim()
            break

        case type === 'number':
            regExp = new RegExp('\\{' + (tag ?? 'n')
                + '(?:\\:([^\\}]+))?\\}(?:\\s*\\(([^\\)]*\\|[^\\)]*)\\))?|\\(([^\\)]*\\|[^\\)]*)\\)', 'g'
            )
            replacer = (_, $1, $2, $3) => $3
                ? interpolate($3.split('|')[i18n.plural(Math.abs(substitute))]?.trim(), substitute)
                : (
                    ($1
                        ? new Intl.NumberFormat(i18n.code, i18n.locale.$?.formats?.number?.[$1]).format(substitute)
                        : substitute
                    ) + ($2
                        ? (' ' + interpolate($2.split('|')[i18n.plural(Math.abs(substitute))]?.trim(), substitute))
                        : ''
                    )
                )
            break

        case substitute instanceof Date:
            regExp = new RegExp('\\{' + (tag ?? 'dt') + '(?:\\:([^\\}]+))?\\}', 'g')
            replacer = (_, $1) => new Intl.DateTimeFormat(
                    i18n.code,
                    $1 ? i18n.locale.$?.formats?.dateTime?.[$1] : {}
                ).format(substitute)
            break

        case Array.isArray(substitute):
            substitute.forEach((s, i) => template = interpolate(template, s, i))
            break

        case type === 'object':
            for (const k in substitute) template = interpolate(
                template,
                substitute[k],
                tag == null ? k : (tag + '.' + k)
            )
            break
    }

    return regExp
        ? template.replace(regExp, replacer)
        : template
}

export function getLocales() {
    return Object.keys(I18n.locales)
        .map(code => [code, I18n.locales[code].$?.name ?? ''])
}

export default i18n