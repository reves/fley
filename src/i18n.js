import getCookie from './utils/getCookie'
import State from './State'

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

let locales = {}

const [i18n, setState] = State({
    code: '',
    locale: {},
    fallback: {},
    pluralRule: null
})

i18n.define = function(newLocales) {

    locales = newLocales

    // Fallback locale will be the first one defined in the locales object
    let fallbackCode = ''

    for (const key in locales) {
        this.fallback = locales[key]
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

i18n.setLocale = function(code) {

    if (!locales.hasOwnProperty(code)) return false

    document.cookie = 'lang=' + code + ';path=/;max-age=31536000;secure;samesite=Lax'

    const locale = locales[code]

    setState({
        code,
        locale,
        pluralRule: locale.$?.pluralRule ?? (n => n == 1 ? 0 : 1)
    })

    return true
}

i18n.getLocales = function() {
    const list = []
    for (const key in locales) list.push([key, (locales[key].$?.name ?? '')])
    return list
}

i18n.t = function(key, substitute = null) {

    const prefix = key.replace(/\.[^\.]*$/, '')
    const keyDefault = prefix ? prefix + '._' : '_'

    let value = getValue(key, this.locale) ||
                getValue(keyDefault, this.locale) ||
                getValue(key, this.fallback) || 
                getValue(keyDefault, this.fallback)

    if (value == null) return ''

    // Resolve references
    value = value.replace(
        /\@\{([^\}]*)\}/g,
        (_, $1) => $1.charAt(0) === '.' ? this.t(prefix + $1) : this.t($1)
    )

    return interpolate(value, substitute)
}

/**
 * Usage cases:
 * 
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
function interpolate(template, sub, tag) {

    if (!template) return ''
    if (sub == null) return template

    switch (typeof sub) {
        case 'number':
            return template.replace(
                new RegExp(
                    '\\{' + (tag ?? 'n') + 
                    '(?:\\:([^\\}]+))?\\}(?:\\s*\\(([^\\)]*\\|[^\\)]*)\\))?|\\(([^\\)]*\\|[^\\)]*)\\)', 'g'
                ),
                (_, $1, $2, $3) => {
                    return $3 ? interpolate($3.split('|')[i18n.pluralRule(Math.abs(sub))]?.trim(), sub) :
                        (
                            ($1 ? new Intl.NumberFormat(i18n.code, i18n.locale.$?.numberFormats?.[$1]).format(sub) : sub) +
                            ' ' +
                            ($2 ? interpolate($2.split('|')[i18n.pluralRule(Math.abs(sub))]?.trim(), sub) : '')
                        )
                }
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
        (_, $1) => new Intl.DateTimeFormat(i18n.code, $1 ? i18n.locale.$?.dateTimeFormats?.[$1] : {}).format(sub)
    )

    if (sub instanceof Array) {
        sub.forEach((s, i) => template = interpolate(template, s, i))
        return template
    }

    for (const k in sub) template = interpolate(template, sub[k], (tag != null ? tag + '.' + k : k))
    return template
}

function getValue(key, object) {
    return key ? key.split('.').reduce((o, i) => o[i], object) : null
}

export default i18n
export const t = i18n.t.bind(i18n)
