import { getCookie } from './utils'
import { createStore } from './ui/hooks'

/**
 * Language Plural Rules:
 * https://unicode-org.github.io/cldr-staging/charts/39/supplemental/language_plural_rules.html
 * http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html?id=l10n/pluralforms
 * 
 * DateTime formatting:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
 * 
 * Number formatting:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat
 */

class I18n {

    static locales = {}

    constructor() {
        this.code = ''
        this.locale = {}
        this.fallback = {}
        this.pluralRule = null
    }

    define(newLocales) {
        this.locales = newLocales

        // Fallback locale will be the first one defined in the locales object
        let fallbackCode = ''

        for (const key in this.locales) {
            this.fallback = this.locales[key]
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
        if (!this.locales.hasOwnProperty(code)) return null
        document.cookie = 'lang=' + code + ';path=/;max-age=31536000;secure;samesite=Lax'
        this.code = code
        this.locale = this.locales[code]
        this.pluralRule = this.locale.$?.pluralRule ?? (n => n == 1 ? 0 : 1)
        return true
    }

    static getLocales() {
        const locales = {}
        for (const key in this.locales) locales[key] = this.locales[key].$?.name ?? ''
        return locales
    }

    static t(key, substitute = null) {
        const prefix = key.replace(/\.[^\.]*$/, '')
        const keyDefault = prefix ? prefix + '._' : '_'

        let value = I18n.getValue(key, this.locale) ||
                    I18n.getValue(keyDefault, this.locale) ||
                    I18n.getValue(key, this.fallback) || 
                    I18n.getValue(keyDefault, this.fallback)

        if (value == null) return ''

        // Resolve references
        value = value.replace(
            /\@\{([^\}]*)\}/g,
            (_, $1) => $1.charAt(0) === '.' ? I18n.t.call(this, prefix + $1) : I18n.t.call(this, $1)
        )

        return I18n.interpolate.call(this, value, substitute)
    }

    static getValue(key, object) {
        return key ? key.split('.').reduce((o, i) => o[i], object) : null
    }

    /**
     * Usage cases
     * ---------------
     * refference1: '@{key.otherKey}',
     * refference2: '@{.sameParentKey}',
     * number1: '{n:format}',
     * number2: '{n} (book | books)',
     * number3: '(a book | {n:format} books)',
     * number4: '(a book | many books)',
     * string: '{s}',
     * boolean: 'My answer is {b: yes || no}',
     * date: 'Published on {d:format}',
     * array: '{0}, {1} and {2}',
     * object1: '{a}, {b:format} and {c.x.y}',
     * object2: 'We bought {a} and {b} (book | books) at the price of {c.x.y:format}',
     */
    static interpolate(template, sub, tag) {
        if (!template) return ''
        if (sub == null) return template

        switch (typeof sub) {
            case 'number':
                return template.replace(
                    new RegExp(
                        '\\{' + (tag ?? 'n') + 
                        '(?:\\:([^\\}]+))?\\}(?:\\s*\\(([^\\)]*\\|[^\\)]*)\\))?|\\(([^\\)]*\\|[^\\)]*)\\)', 'g'
                    ), (_, $1, $2, $3) => $3
                        ? I18n.interpolate.call(this, $3.split('|')[this.pluralRule(Math.abs(sub))]?.trim(), sub)
                        : (($1
                            ? new Intl.NumberFormat(this.code, this.locale.$?.numberFormats?.[$1]).format(sub)
                            : sub) + ' ' + ($2
                            ? I18n.interpolate.call(this, $2.split('|')[this.pluralRule(Math.abs(sub))]?.trim(), sub)
                            : ''
                        ))
                )

            case 'string':
                return template.replace(new RegExp('\\{' + (tag ?? 's') + '\\}', 'g'), sub)

            case 'boolean':
                return template.replace(
                    new RegExp('\\{' + (tag ?? 'b') + '\\:([^\\}]*)\\|\\|([^\\}]*)\\}', 'g'),
                    (_, $1, $2) => sub ? $1.trim() : $2.trim()
                )

            case 'object':
                break

            default:
                return template
        }

        if (sub instanceof Date) return template.replace(
            new RegExp('\\{' + (tag ?? 'd') + '(?:\\:([^\\}]+))?\\}', 'g'),
            (_, $1) => new Intl.DateTimeFormat(this.code, $1 ? this.locale.$?.dateTimeFormats?.[$1] : {}).format(sub)
        )

        if (sub instanceof Array) {
            sub.forEach((s, i) => template = I18n.interpolate.call(this, template, s, i))
            return template
        }

        for (const k in sub) {
            template = I18n.interpolate.call(this, template, sub[k], (tag != null ? tag + '.' + k : k))
        }
        return template
    }
}

const i18n = createStore(I18n)

export const t = I18n.t.bind(i18n)
export const getLocales = I18n.getLocales.bind(i18n)
export default i18n