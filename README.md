# ley

Frontend JavaScript web framework based on [JSX syntax](https://github.com/facebook/jsx) and concurrent renderer with [Fiber Architecture](https://github.com/acdlite/react-fiber-architecture).

- [Quick Start](#quick-start)
- [Usage](#usage)
- [Hooks](#hooks)
- [Store (global states)](#store)
- [Router](#router)
- [I18n](#i18n)
- API Client

## Quick Start
#### 1. Install the required development packages
```
npm install --save-dev @babel/core @babel/plugin-transform-react-jsx
```
#### 2. Set up the [Babel JSX transform plugin](https://babeljs.io/docs/en/babel-plugin-transform-react-jsx#usage)
```javascript
plugins: [
    [
        '@babel/plugin-transform-react-jsx',
        {
            runtime: 'automatic',
            importSource: 'ley'
        }
    ],
]
```
## Usage
```javascript
ley('Hello, World!') // By default, uses document.body as the root element.
ley('Hello, World!', document.getElementById('root'))
```
```javascript
import ley, { useState } from 'ley'

function App() {
    const [count, setCount] = useState(0)
    return <>
        <div>You clicked {count} times</div>
        <button onClick={() => setCount(count + 1)}>+</button>
    </>
}

ley(<App/>)
```
#### Inline HTML
```javascript
import ley, { Inline } from 'ley'
import icon from './icon.svg' // e.g. using Webpack asset/source

ley(
    <>
        <Inline html="<b>The icon:</b> " />
        <Inline html={icon} />
    </>
)
```

## Hooks
- [useState](#usestate)
- [useEffect, useLayoutEffect](#useEffect)
- [useRef](#useref)
- [useStore](#usestore)

### useState
```javascript
const [state, setState] = useState(initialValue)
```

### <a id='useEffect'></a> useEffect  `(async)`, useLayoutEffect `(sync)`
```javascript
useEffect(() => {
    // side effect
    return () => {
        // cleanup
    }
})
useEffect(func, [])
useEffect(func, [a, b])
```

### useRef
```javascript
const ref = useRef(initialValue)
```
```javascript
function Component() {
    const inputElement = useRef()
    const onButtonClick = () => inputElement.current.focus()
    return <>
        <input ref={inputElement} type="text" />
        <button onClick={onButtonClick}>Focus the input</button>
    </>
}
```

### useStore
```javascript
useStore(store)
```
```javascript
function Component() {
    useStore(router)
    return <div>The current route is {router.name}</div>
}
```

## Store
A store is an object that contains a global state (properties) and its actions (methods).

### createStore
```javascript
const store = createStore(Class)
```
```javascript
import ley, { createStore, useStore } from 'ley'

class ThemeStore
{
    static styles = ['light', 'dark']

    constructor()
    {
        this.style = 'dark'
    }

    toggleStyle()
    {
        // Calls to other actions do not cause additional rendering.
        // Returning "null" prevents rendering.
        return this.style === 'light'
            ? this.setStyle('dark')
            : this.setStyle('light')
    }

    setStyle(style)
    {
        if (!ThemeStore.styles.includes(style)) {
            return null
        }
        this.style = style
    }
}

const theme = createStore(ThemeStore)

function App() {
    useStore(theme)
    return <>
        <div>The current theme style is {theme.style}</div>
        <button onClick={() => theme.toggleStyle()}>Change theme style</button>
    </>
}

ley(<App/>)
```

## Router
- router.name
- router.path
- router.params
- router.query
- router.hash
- router.redirectedFrom
- [router.define()](#routerdefine)
- [router.go()](#routergo)

```javascript
import ley, { useStore } from 'ley'
import router from 'ley/router'

router.define({
	home: /\/$/i,
	about: /\/about/i,
})

function App() {
    useStore(router)

    const page = router.name === 'home'
        ? 'Home Page'
        : (router.name === 'about'
            ? 'About Us'
            : 'Page Not Found')

    return <>
        <a href="/">Home</a> | <a href="/about">About</a>
        <h1>{page}</h1>
    </>
}

ley(<App/>)
```
#### router.define()
Defines named routes using regular expressions, especially [named groups](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Groups_and_Ranges#using_named_groups) for dynamic params.
```javascript
router.define({
	home: /\/$/i,
	user: /\/user\/(?<username>.*)$/i, // route.params.username
})
```
#### router.go()
Navigates programmatically.
```javascript
router.go('/about')
router.go('/about', () => window.scrollTo(0, 0))
```
## I18n
- i18n.code
- i18n.locale
- i18n.pluralRule
- [i18n.define()](#i18ndefine)
- [i18n.setLocale()](#i18nsetlocale)
- [Configuration](#configuration)
- [Formatting](#formatting)
```javascript
import ley, { useStore } from 'ley'
import i18n, { t } from 'ley/i18n'

const en = { message: { hello: 'Hello!' } }
const ro = { message: { hello: 'Bună!' } }

i18n.define({
    'en-US': en,
    'ro-RO': ro
})

function App() {
    useStore(i18n)
    return <>
        <div>{ t('message.hello') }</div>
        <button onClick={() => i18n.setLocale('en-US')}>EN</button>
        <button onClick={() => i18n.setLocale('ro-RO')}>RO</button>
    </>
}

ley(<App/>)
```
#### i18n.define()
Defines language codes and corresponding locale objects. The first defined will be the fallback locale.
```javascript
i18n.define({
    en: { // Fallback locale
        _: 'Not yet translated', // Fallback key
        greeting: 'Good morning!',
        common: ':-)'
    },
    ro: {
        // _: '' // Fallback key that prevents the use of the fallback locale
        greeting: 'Bună dimineaţa!'
    }
})

i18n.setLocale('ro')
t('greeting')   // Bună dimineaţa!
t('common')     // :-)
t('abc')     // Not yet translated
```
#### i18n.setLocale()
Sets the locale by the defined language code.
```javascript
i18n.setLocale('en')
```

### Configuration
See the [List of plural rules](https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html), or learn more about [Language Plural Rules](https://unicode-org.github.io/cldr-staging/charts/39/supplemental/language_plural_rules.html).
```javascript
const ro = {

    // Config
    $: {
        // Locale display name.
        // default: ''
        name: 'Română',
        
        // Pluralization rule.
        // default: rule of the english language
        plural: n => n==1 ? 0 : (n==0 || (n%100>0 && n%100<20) ? 1 : 2),

        // Lists of named formatting options for Intl API constructors.
        formats: {
            // Named options for date and time formatting.
            // default: Intl.DateTimeFormat() default options
            dateTime: {
                
                comment: {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                },
                post: {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                    hour: 'numeric',
                    minute: 'numeric'
                }

            },
            // Named options for number formatting.
            // default: Intl.NumberFormat() default options
            number: {

                price: {
                    style: 'currency',
                    currency: 'EUR',
                    currencyDisplay: 'symbol'
                }

            }
        }
    },

    // Translations
    // ...
}
```

### Formatting

#### Reference
```javascript
const en = {   
    message: { hello: 'Hello' },
    main: { 
        greeting: '@{message.hello}, World!', // absolute
        title: '@{.greeting} How are you today?', // relative to the parent
    }
}
```
```javascript
t('main.title') // Hello, World! How are you today?
```

#### String
```javascript
const en = { message: 'Hello, {s}!' }
```
```javascript
t('message', 'World') // Hello, World!
```

#### Boolean
```javascript
const en = { message: 'My answer is {b: yes || no}' }
```
```javascript
t('message', true) // My answer is yes
t('message', false) // My answer is no
```

#### Number
See [Number formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat) options.
```javascript
const en = {
    $: {
        formats: {
            number: {
                price: {
                    style: 'currency',
                    currency: 'USD',
                    currencyDisplay: 'symbol'
                }
            }
        }
    },

    buy: 'Buy now for {n:price}!', // using a format
    add: 'Add (a book | {n} books) to your shopping cart.',
    cart: 'You have {n} (book | books) in your shopping cart.',
    category: 'We have (one book | many books) in this category.',
}
i18n.define({ 'en-US': en })
```
```javascript
t('buy', 4.99)      // Buy now for $4.99!
t('add', 2)         // Add 2 books to your shopping cart.
t('cart', 3)        // You have 3 books in your shopping cart.
t('category', 1)    // We have one book in this category.
```

#### DateTime
See [DateTime formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) options.
```javascript
const en = { message: 'Published on {dt:comment}' }
```
```javascript
t('message', new Date('Dec 31, 2000')) // Published on 12/31/2000
```

#### Array
```javascript
const en = { message: 'Comparison of {0} and {1} at a price of {2:price}' }
```
```javascript
t('message', ['A', 'B']) // Comparison of A and B at a price of $9.99
```

#### Object
```javascript
const en = { message: 'We bought {a} and {b} (book | books) at the price of {c.x.y:price}' }
```
```javascript
t('message', { a: 'a pencil', b: 10, c: { x: { y: 49.99 } } })
// We bought a pencil and 10 books at the price of $49.99
```