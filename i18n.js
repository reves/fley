import { getCookie } from './utils'
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
let code = ''
let locale = null
let fallback = null
let pluralRule = null

const [i18n, setState] = State()

i18n.define = (newLocales) => {

    locales = newLocales

    // Fallback locale will be the first one defined in the locales object
    let fallbackCode = ''

    for (const key in locales) {
        fallback = locales[key]
        fallbackCode = key
        break
    }

    // Detect locale from the cookie
    if (i18n.setLocale(code = getCookie('lang'))) return

    // Detect locale from the browser
    if (i18n.setLocale(code = navigator.language)) return

    // Use the fallback locale
    i18n.setLocale(code = fallbackCode)
}

i18n.setLocale = (newCode) => {

    if (!locales.hasOwnProperty(newCode)) return false

    code = newCode
    locale = locales[code]
    pluralRule = locale.$?.pluralRule ?? (n => n == 1 ? 0 : 1)
    document.cookie = 'lang=' + code + ';path=/;max-age=31536000;secure;samesite=Lax'
    setState()

    return true
}

i18n.getCode = _ => code

i18n.getLocales = _ => {
    const list = []
    for (const key in locales) list.push([key, (locales[key].$?.name ?? '')])
    return list
}

i18n.t = (key, substitute = null) => {

    const prefix = key.replace(/\.[^\.]*$/, '')
    const keyDefault = prefix ? prefix + '._' : '_'

    let value = getValue(key, locale) ||
                getValue(keyDefault, locale) ||
                getValue(key, fallback) || 
                getValue(keyDefault, fallback)

    if (value == null) return ''

    // Resolve references
    value = value.replace(
        /\@\{([^\}]*)\}/g,
        (_, $1) => $1.charAt(0) === '.' ? i18n.t(prefix + $1) : i18n.t($1)
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
                    return $3 ? interpolate($3.split('|')[pluralRule(Math.abs(sub))]?.trim(), sub) :
                        (
                            ($1 ? new Intl.NumberFormat(code, locale.$?.numberFormats?.[$1]).format(sub) : sub) + ' ' +
                            ($2 ? interpolate($2.split('|')[pluralRule(Math.abs(sub))]?.trim(), sub) : '')
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
        (_, $1) => new Intl.DateTimeFormat(code, $1 ? locale.$?.dateTimeFormats?.[$1] : {}).format(sub)
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
export const t = i18n.t
