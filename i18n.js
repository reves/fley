import { getCookie } from './utils'
import State from './State'

/**
 * Language Plural Rules:
 * https://unicode-org.github.io/cldr-staging/charts/39/supplemental/language_plural_rules.html
 * http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html?id=l10n/pluralforms
 */
const pluralRules = [
    [
        ['af','an','ast','az','bg','bn','ca','da','de','dev','el','en','eo','es','et','eu','fi','fo','fur','fy','gl',
        'gu','ha','hi','hu','hy','ia','it','kn','ku','lb','mai','ml','mn','mr','nah','nap','nb','ne','nl','nn','no',
        'nso','or','pa','pap','pms','ps','pt-PT','rm','sco','se','si','so','son','sq','sv','sw','ta','te','tk','ur',
        'yo'],
                    n => n == 1 ? 0 : 1
    ],
    [
        ['ay','bo','cgg','fa','ht','id','ja','jbo','ka','kk','km','ko','ky','lo','ms','sah','su','th','tt','ug','vi', 
        'wo','zh'],
                    _ => 0
    ],
    [
        ['ach','ak','am','arn','br','fil','gun','ln','mfe','mg','mi','oc','pt','pt-BR','tg','tl','ti','tr','uz','wa'], 
                    n => n > 1 ? 1 : 0
    ],
    [
        ['be','bs','cnr','dz','hr','ru','sr','uk'],
                    n => n%10 == 1 && n%100 != 11 ? 0 : (n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20) ? 1 : 2)
    ],
    [['csb','pl'],  n => n == 1 ? 0 : (n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20) ? 1 : 2)],
    [['cs','sk'],   n => n == 1 ? 0 : (n >= 2 && n <= 4 ? 1 : 2)],
    [['he','iw'],   n => n == 1 ? 0 : (n == 2 ? 1 : ((n < 0 || n > 10) && n%10 == 0 ? 2 : 3))],
    [['mnk'],       n => n == 0 ? 0 : (n == 1 ? 1 : 2)],
    [['ar'],        n => n == 0 ? 0 : (n == 1 ? 1 : (n == 2 ? 2 : (n%100 >= 3 && n%100 <= 10 ? 3 : (n%100 >= 11 ? 4 : 5))))],
    [['cy'],        n => n == 1 ? 0 : (n == 2 ? 1 : (n != 8 && n != 11 ? 2 : 3))],
    [['fr'],        n => n >= 2 ? 1 : 0],
    [['ga'],        n => n == 1 ? 0 : (n == 2 ? 1 : (n < 7 ? 2 : (n < 11 ? 3 : 4)))],
    [['gd'],        n => n == 1 || n == 11 ? 0 : (n == 2 || n == 12 ? 1 : (n > 2 && n < 20 ? 2 : 3))],
    [['is'],        n => n%10 != 1 || n%100 == 11 ? 1 : 0],
    [['jv'],        n => n !== 0 ? 1 : 0],
    [['kw'],        n => n == 1 ? 0 : (n == 2 ? 1 : (n == 3 ? 2 : 3))],
    [['lt'],        n => n%10 == 1 && n%100 != 11 ? 0 : (n%10 >= 2 && (n%100 < 10 || n%100 >= 20) ? 1 : 2)],
    [['lv'],        n => n%10 == 1 && n%100 != 11 ? 0 : (n != 0 ? 1 : 2)],
    [['mk'],        n => n == 1 || n%10 == 1 && n%100 != 11 ? 0 : 1],
    [['mt'],        n => n == 1 ? 0 : (n == 0 || (n%100 > 1 && n%100 < 11) ? 1 : (n%100 > 10 && n%100 < 20 ? 2 : 3))],
    [['ro'],        n => n == 1 ? 0 : (n == 0 || (n%100 > 0 && n%100 < 20) ? 1 : 2)],
    [['sl'],        n => n%100 == 1 ? 1 : (n%100 == 2 ? 2 : (n%100 == 3 || n%100 == 4 ? 3 : 0))]
]


// TODO:
// Number formatting
// DateTime since: e.g. n minutes ago
// Separating DateTime or Number value for styling

// Refactor spaghetti code
// Treat not found key error
// Move pluralization rule to the locale file?
// Use something like <lang key=”greeting”/> buit-in ley component, that listens to language state.
// Lazy loading


let locales = {}
let fallback = null
let locale = null
let code = ''
let rule = null
let dateTimeFormat = {} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters
let numberFormat = {} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters

const [i18n, setState] = State({})

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
    if (i18n.set(code = getCookie('lang'))) return

    // Detect locale from the browser
    if (i18n.set(code = navigator.language)) return

    // Use the fallback locale
    i18n.set(code = fallbackCode)
}

i18n.set = (newCode) => {
    if (!locales.hasOwnProperty(newCode)) return false
    code = newCode
    document.cookie = 'lang=' + code + ';path=/;max-age=31536000;secure;samesite=Lax'
    locale = locales[code]
    rule = getRule(code) || pluralRules[0][1]
    if (locale._dateTime) for (const key in locale._dateTime) { dateTimeFormat = locale._dateTime[key]; break }
    else dateTimeFormat = {}
    if (locale._number) for (const key in locale._number) { numberFormat = locale._number[key]; break }
    else numberFormat = {}
    setState()
    return true
}

i18n.getCode = _ => code

i18n.getLocales = _ => {
    const list = []
    for (const key in locales) list.push([ key, (locales[key]['_name'] || '') ])
    return list
}

i18n.t = (key, sub = null) => {

    const parentKey = key.replace(/\.[^\.]*$/, '')
    const fallbackKey = parentKey ? parentKey + '._' : ''

    let value = getValue(key, locale) || 
        getValue(fallbackKey, locale) ||
        getValue(key, fallback) || 
        getValue(fallbackKey, fallback)

    if (value == null) {
        console.error('Not found transaltion for the "' + key + '" key in the "' + code + '" locale.')
        return ''
    }

    value = value.replace( // resolve includes
        /\@\{([^\}]*)\}/g,
        (_, $1) => $1.charAt(0) === '.' ? i18n.t(parentKey + $1) : i18n.t($1)
    )

    return interpolate(value, sub)
}

function interpolate(tpl, sub, tag) {
    if (sub == null) return tpl
    if (typeof sub === 'number') return tpl.replace(
        new RegExp('\\{' + (tag || 'n') + '\\}(?:(\\s*)\\(([^\\)]*\\|[^\\)]*)\\))?|\\(([^\\)]*\\|[^\\)]*)\\)', 'g'),
        (_, $1, $2, $3) => $3 ? $3.replace(new RegExp('\\{' + (tag || 'n') + '\\}', 'g'), sub).split('|', 10)[rule(Math.abs(sub))].trim() : sub + ($1 || '') + ($2 ? $2.split('|', 10)[rule(Math.abs(sub))].trim() : '')
    )
    if (typeof sub === 'string') return tpl.replace(new RegExp('\\{' + (tag || 's') + '\\}', 'g'), sub)
    if (typeof sub === 'boolean') return sub ? tpl : ''
    if (typeof sub !== 'object') return tpl
    if (sub instanceof Date) return tpl.replace(
        new RegExp('\\{' + (tag || 'd') + '(?:,([^\\}]+))?\\}', 'g'),
        (_, $1) => new Intl.DateTimeFormat(code, $1 ? locale._dateTime[$1.trim()] : dateTimeFormat).format(sub)
    )
    if (sub instanceof Array) {
        sub.forEach((s, i) => tpl = interpolate(tpl, s, i))
        return tpl
    }
    for (const k in sub) tpl = interpolate(tpl, sub[k], (tag ? tag + '.' + k : k))
    return tpl
}

function getRule(code) {
    for (let i=0; i<pluralRules.length; i++) {
        for (let j=0; j<pluralRules[i][0].length; j++) {
            if (pluralRules[i][0][j] === code) return pluralRules[i][1]
        }
    }
}

function getValue(key, object) {
    return key ? key.split('.').reduce((o, i) => o[i], object) : null
}

export default i18n
