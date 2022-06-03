# ley

Frontend JavaScript web framework based on [JSX syntax](https://github.com/facebook/jsx) and concurrent renderer with [Fiber Architecture](https://github.com/acdlite/react-fiber-architecture).

- [Installation](#installation)
- [Usage](#usage)
- [Hooks](#hooks)
- [Store (global states)](#store)
- [Router](#router)
- [I18n](#i18n)
- [API Client](#api-client)

## Installation
```console
npm i ley@npm:@reves/ley
```

#### Required development packages
```console
npm i -D @babel/core @babel/plugin-transform-react-jsx
```
#### Set up the [Babel JSX transform plugin](https://babeljs.io/docs/en/babel-plugin-transform-react-jsx#usage)
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
A ___store___ is an object that contains a ___global state___ (properties) and ___actions___ (non-static methods).

- [createStore](#createstore)
- [Asynchronous actions](#asynchronous-actions)

### createStore
```javascript
const store = createStore(Class)
```
```javascript
import ley, { createStore, useStore } from 'ley'
import api from 'ley/api'

class ThemeStore
{
    static styles = ['light', 'dark']

    constructor()
    {
        this.style = 'dark'
    }

    toggleStyle()
    {
        // 1) Inner calls to other actions do not cause additional rendering.
        // 2) Returning "null" from the most outer action prevents rendering.
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

### Asynchronous actions
The reserved method `this.action(callback)` performs manual dispatch.
```javascript
class UsersStore
{
    constructor()
    {
        this.users = []
        this.total = 0
    }
    
    fetchUsers() {
        api.get('/users').success((res) => {
            this.action(() => {
                this.users = res.list
                this.total = res.total
            })
            // Or
            // this.users = res.list
            // this.total = res.total
            // this.action() // commit state
        })
        return null // prevent rendering
    }
}
```

## Router
- router.name - The name of the route that matches the current path.
- router.path - The current path.
- router.params - Dynamic params (regExp named capturing groups).
- router.query - Query parameters from the current URL.
- router.hash - The fragment from the current URL (including `#`).
- router.from - The name of the previous route.
- [router.define()](#routerdefine)
- [router.go()](#routergo)
- [Metadata](#metadata)

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

### Metadata
Managing metadata in the `<head>` section.
```javascript
import { setTitle, setMeta, setSchema } from 'ley/router'

// These functions run as side effects and therefore do not change the state of 
// the router (no re-rendering).
```

#### Title
Updates the document title.
```javascript
setTitle("Home Page")
```
```html
<head>
    <!-- ... -->
    <title>Home Page</title>
</head>
```

#### Meta tags
Adds meta tags. On subsequent calls, removes all previously added tags before adding new ones.
```javascript
setMeta([
    { name: "description", content: "Book description." },
    { property: "og:title", content: "Book Title" },
])
```
```html
<head>
    <!-- ... -->
    <meta name="description" content="Book description.">
    <meta property="og:title" content="Book Title">
</head>
```

#### Schema
Updates the structured data.
```javascript
setSchema({
    "@context": "https://schema.org/",
    "@type": "Book",
    "name": "Book Title",
    "description": "Book description.",
})
```
```html
<head>
    <!-- ... -->
    <script type="application/ld+json">
        {
            "@context": "https://schema.org/",
            "@type": "Book",
            "name": "Book Title",
            "description": "Book description."
        }
    </script>
</head>
```

## I18n
- i18n.code - The current language code.
- i18n.locale - Reference to the current locale object.
- i18n.plural - Reference to the current locale plural rule (function).
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
The configuration object must be assigned to the reserved property `$` of the locale object.

The required plural rule can be found in the [List of plural rules](https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html). Learn more about [Language Plural Rules](https://unicode-org.github.io/cldr-staging/charts/39/supplemental/language_plural_rules.html).
```javascript
const ro = {

    // Config
    $: {
        
        // Locale display name.
        // Default: ''
        name: 'Română',
        
        // Pluralization rule (function).
        // Default: n => n == 1 ? 0 : 1
        plural: n => n==1 ? 0 : (n==0 || (n%100>0 && n%100<20) ? 1 : 2),

        // Defined formatting options for Intl API constructors.
        formats: {

            // Defined options for date and time formatting.
            // Will be used as the second argument for Intl.DateTimeFormat()
            dateTime: {

                "comment": {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                },
                "post": {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                    hour: 'numeric',
                    minute: 'numeric'
                }

            },

            // Defined options for number formatting.
            // Will be used as the second argument for Intl.NumberFormat()
            number: {

                "price": {
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

#### Reference `@{ [keyA.keyB] }`, `@{ [.key] }`
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

#### String `{s}`
```javascript
const en = { message: 'Hello, {s}!' }
```
```javascript
t('message', 'World') // Hello, World!
```

#### Boolean `{b: [==true] || [==false] }`
```javascript
const en = { message: 'My answer is {b: yes || no}' }
```
```javascript
t('message', true) // My answer is yes
t('message', false) // My answer is no
```

#### Number `{n}`, `{n: [format] }`, `( [plural==0] | [plural==1] | ... )`
See [Number formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat) options.
```javascript
const en = {
    // Config
    $: {
        formats: {
            number: {
                "price": {
                    style: 'currency',
                    currency: 'USD',
                    currencyDisplay: 'symbol'
                }
            }
        }
    },
    // Translations
    buy: 'Buy now for {n:price}!', // using the defined formatting options "price"
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

#### DateTime `{dt}`, `{dt: [format] }`
See [DateTime formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) options.
```javascript
const en = { message: 'Published on {dt:comment}' }
```
```javascript
t('message', new Date('Dec 31, 2000')) // Published on 12/31/2000
```

#### Array elements `{ [index] }`
```javascript
const en = { message: 'Comparison of {0} and {1} at a price of {2:price}' }
```
```javascript
t('message', ['A', 'B', 9.99]) // Comparison of A and B at a price of $9.99
```

#### Object properties `{ [name] }`, `{ [nameA.nameB] }`
For each property, its type is automatically determined, so the formatting rules described above can be applied.
```javascript
const en = { message: 'We bought {a} and {b} (book | books) at the price of {c.x.y:price}' }
```
```javascript
t('message', { a: 'a pencil', b: 10, c: { x: { y: 49.99 } } })
// We bought a pencil and 10 books at the price of $49.99
```

## API Client
- [api.init()](#apiinit)
- [api.get()](#apiget)
- [api.post()](#apipost)
- [api.request()](#apirequest)
- [Instance](#instance)
- [Events](#events)
- [Cancellation](#cancellation)


```javascript
import api from 'ley/api'

api.init({ baseURL: 'https://api.example.com'})

api.get('/books?id=1')
    .success((response, status, event) => {
        console.log(response.title)
        console.log(response.author)
    })
    .fail((response, status, event) => {
        console.log("Couldn't find the book.")
    })
    .error((response, status, event) => {
        console.log("An error occured. Please try again later.")
    })
```

#### api.init()
Updates the current settings of request.
```javascript
api.init({
    // Endpoint prefix
    // Default: ''
    baseURL: 'https://api.example.com',

    // Response data type.
    // Default: 'json'
    responseType: 'json',

    // Name of the cookie containing the CSRF token.
    // The cookie value will be set in the "X-CSRF-Token" request header for all
    // the POST requests.
    // Default: ''
    CSRFCookie: 'csrftoken',

    // Custom request headers.
    // Default: {}
    headers: { "X-Requested-With": "XMLHttpRequest" },

    // Request timeout in milliseconds.
    // Default: 5000
    timeout: 5000
})
```

#### api.get()
```javascript
api.get('/books?id=1')
api.get('/books', { id: 1 })
```

#### api.post()
```javascript
api.post('/books', {
    title: "Book title",
    description: "Description",
    author: "Author",
    cover: fileInputElement.files[0]
})
```

#### api.request()
```javascript
const method = 'PUT'
const endpoint = '/books'
const body = JSON.stringify({ title: "The title" })

api.request(method, endpoint, body)
```

### Instance
```javascript
import { Api } from 'ley/api'

const api = new Api({
    responseType: 'document'
    // ...
})
```

### Events
```javascript
api.get('/endpoint')
    .progress((event) => {
        // XMLHttpRequest progress event
    })
    .success((response, status, event) => {
        // XMLHttpRequest load event
        // status 2xx
    })
    .fail((response, status, event) => {
        // XMLHttpRequest load event
        // status 4xx
    })
    .error((response, status, event) => {
        // XMLHttpRequest error/timeout/load event
        // status != 2xx && status != 4xx
    })
    .always((response, status, event) => {
        // XMLHttpRequest loadend event
        // (this event fires even after abort)
    })
```

### Cancellation
```javascript
const handler = api.get('/books?id=1')

// Something happened ...
handler.abort()
```