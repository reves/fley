# ley

Frontend JavaScript web framework based on [JSX syntax](https://github.com/facebook/jsx) and concurrent renderer with [Fiber Architecture](https://github.com/acdlite/react-fiber-architecture).

- [Installation](#installation)
- [Usage](#usage)
- [Hooks](#hooks)
- [Global state](#global-state)
- [Router](#router)
- [I18n](#i18n)
- [API client](#api-client)
- [Pre-rendering (SSR)](#pre-rendering-ssr)

## Installation
```console
npm i ley@npm:@reves/ley
```
```console
npm i -D @babel/core @babel/plugin-transform-react-jsx
```
#### Set up the [Babel JSX transform plugin](https://babeljs.io/docs/en/babel-plugin-transform-react-jsx#usage)
```javascript
// e.g. in webpack.config.js
{
    test: /\.jsx?$/,
    exclude: /node_modules/,
    use: {
        loader: 'babel-loader',
        options: {
            plugins: [[
                '@babel/plugin-transform-react-jsx',
                { runtime: 'automatic', importSource: 'ley' }
            ]]
        }
    }
},
```
## Usage

```javascript
ley('Hello, World!') // By default, uses document.body as the root element.
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

ley(<App />, document.getElementById("app"))
```
#### Inline HTML

```javascript
import ley, { Inline } from 'ley'
import iconUser from './icon-user.svg' // e.g. using Webpack

// The resulting DOM node is reused if the 'html' string
// remains the same.
ley(<>
    <Inline html={iconUser} width="16px"/>
    <Inline html="<ul> <li>One</li> <li>Two</li> </ul>" style="color: green;"/>
    <Inline html="Must start with an outer element. <p>This is omitted</p>"/>
    <Inline html="Plain text"/>
</>)
```
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="16px">
    <circle cx="50" cy="50" r="50"></circle>
</svg>
<ul style="color: green;">
    <li>One</li>
    <li>Two</li>
</ul>
Must start with an outer element.
Plain text
```
#### Optimization
The `memo` prop tells if the props and contents have remained the same since the last render. In other words, when it evaluates to `true`, the Element/Component is skipped in the reconciler.

```javascript
function Item({ name }) {
    console.log('Item update')
    return <div>{ name }</div>
}

function List() {
    console.log('List update')
    const [items, setItems] = useState(['a', 'b', 'c'])

    useEffect(() => {
        setItems([123, 'b', 'c']) // change an item
    }, [])

    // (!) Always use the `key` prop if the memoized Element/Component
    // can change its order among its siblings.
    return <>
        <div memo> {/* same as memo={true} */}
            This div is always reused. Also it never changes its position,
            therefore, in this case, the "key" prop is not needed.
        </div>
        {items.map((item, i) =>
            <Item
                key={i}
                name={item}
                memo={(prev, next) => prev.name === next.name}
            />
        )}
    </>
}

ley(<List/>)

// Without "memo":
// (1) List update
// (3) Item update <-- every Item is updated

// With "memo":
// (1) List update
// (1) Item update <-- only the changed Item is updated
```
#### Synchronous rendering
The `Sync` component disables concurrency when rendering its subtree. This way it allows everything it wraps to be rendered synchronously.
```javascript
import ley, { Sync } from 'ley'
import App from './App'

ley(<Sync><App /></Sync>)
```

## Hooks
- [useState](#usestate)
- [useEffect, useLayoutEffect](#useEffect)
- [useRef](#useref)
- [useMemo](#usememo)
- [useCallback](#usecallback)
- [Metadata](#metadata)
    - [useTitle](#usetitle)
    - [useMeta](#usemeta)
    - [useSchema](#useschema)

### useState
```javascript
const [state, setState] = useState(initialState, actions)
```
```javascript
function Component() {
    const [count, setCount] = useState(0)
    const inc = () => setCount(count + 1)
    const dec = () => setCount(c => c - 1)
    return <>
        <p>Count: {count}</p>
        <button onClick={inc}> + </button>
        <button onClick={dec}> - </button>
    </>
}
```
Example using *actions*
```javascript
function Component() {
    const [count, counter] = useState(0, {
        inc: (c, amount) => c + amount,
        dec: (c) => --c
    })
    return <>
        <p>Count: {count}</p>
        <button onClick={counter.inc(10)}> + </button>
        <button onClick={counter.dec()}> - </button>
        <button onClick={counter(0)}> Res </button>
    </>
}
```

### <a id='useEffect'></a> useEffect  `(async)`, useLayoutEffect `(sync)`
```javascript
useEffect(fn, [deps])
```
```javascript
useEffect(() => {
    // side effect
    return () => {
        // cleanup
    }
})
```

### useRef
```javascript
const ref = useRef(initialValue)
```
The current value can be received by `ref()` and set by `ref(newValue)`.
```javascript
function Component() {
    const input = useRef()
    const onButtonClick = () => input()?.focus()
    return <>
        <input ref={input} type="text" />
        <button onClick={onButtonClick}>Focus the input</button>
    </>
}
```
#### Callback ref
```javascript
function Component() {
    let input = null
    const onButtonClick = () => input?.focus()
    return <>
        <input ref={(el) => input = el} type="text" />
        <button onClick={onButtonClick}>Focus the input</button>
    </>
}
```

### useMemo
```javascript
const memoizedResult = useMemo(fn, [deps])
```

### useCallback
```javascript
const memoizedCallback = useCallback(fn, [deps])
```

### Metadata
Managing the metadata in the `<head>` section.
```javascript
import { useTitle, useMeta, useSchema } from 'ley/head'

// Hooks used in a deeper and farther component overwrite the value.
```

#### useTitle
Sets the document title.
```javascript
useTitle("Home page")
```
```html
<title>Home page</title>
```

#### useMeta
Adds meta tags (removes all previously added tags before adding new ones).
```javascript
useMeta([
    { name: "description", content: "Book description." },
    { property: "og:title", content: "Book Title" },
])
```
```html
<meta name="description" content="Book description.">
<meta property="og:title" content="Book Title">
```

#### useSchema
Updates the structured data.
```javascript
useSchema({
    "@context": "https://schema.org/",
    "@type": "Book",
    "name": "Book Title",
    "description": "Book description.",
})
```
```html
<script type="application/ld+json">
    {
        "@context": "https://schema.org/",
        "@type": "Book",
        "name": "Book Title",
        "description": "Book description."
    }
</script>
```

## Global state
- [createValue](#createvalue)
- [createStore](#createstore)
- [withCondition](#withcondition)

### createValue
Creates a stored value (reference).
```javascript
const value = createValue(initial, actions)
```
```javascript
import ley, { createValue } from 'ley'

const actionsDescriptor = {
    inc: c => ++c,
    dec: c => --c
}
const count = createValue(0, actionsDescriptor)

function App() {
    return <>
        <div>You clicked {count} times</div>
        <button onClick={() => count.inc()}>+</button>
        <button onClick={() => count.dec()}>-</button>
        <button onClick={() => count(0)}>Res</button>
    </>
}

ley(<App />)
```

#### `count` is a Component

The `count` is a Component that wraps the stored value and only re-renders when the stored value changes.

```javascript
function App() {
    return <>
        Count: {count}
        <p>This won't re-render when the stored value changes.</p>
    </>
}

// Under the hood (not an actual implementation)
const count = function() {
    const [value, setValue] = useState(0)
    return value
}
```

#### `count()` is also a getter
The `count()` is a function that returns the stored value and, at the same time, makes the outer Component reactive to the stored value changes.
```javascript
function App() {
    return <>
        Count: {count()}
        <p>This will re-render each time the stored value changes.</p>
    </>
}
```
#### `count(newValue)` is also a setter
The `count(newValue)` is a function that changes the stored value.
```javascript
function App() {
    return <>
        Count: {count()}
        <button onClick={() => count(c => c+2)}>+2</button>
        <button onClick={() => count(0)}>Res</button>
    </>
}
```

### createStore
A ***store*** is an instance of the Store class, it contains the ***state*** (properties created in the constructor) and the ***actions*** (non-static methods of the class, including inherited).

```javascript
const store = createStore(StoreClass, ...constructorArgs)
```

By accessing any property of the store inside a Component, that Component automatically becomes reactive to the actions.

```javascript
import ley, { createStore } from 'ley'
import api from 'ley/api'

class Theme {
    static styles = ['light', 'dark']

    constructor() {
        this.style = 'dark'
    }

    toggleStyle() {
        // 1) Inner calls to other actions do not cause additional rendering.
        // 2) Returning "null" from the initially called action prevents rendering.
        return this.style === 'light'
            ? this.setStyle('dark')
            : this.setStyle('light')
    }

    setStyle(style) {
        if (!Theme.styles.includes(style)) {
            return null
        }
        this.style = style
    }
}

const theme = createStore(Theme)

function App() {
    return <>
        <div>The current theme style is {theme.style}</div>
        <button onClick={() => theme.toggleStyle()}>Change theme style</button>
    </>
}

ley(<App/>)
```

#### Asynchronous actions
The reserved method `this.action([callback])` performs manual dispatch.
```javascript
class Users {
    constructor() {
        this.users = []
    }
    
    fetchUsers() {
        api.get('/users').success((res) => {
            this.users = res.list
            this.action()
            // Or just wrap the changes in a callback:
            // this.action(() => {
            //    this.users = res.list
            // })
        })
        return null // prevent rendering at this moment
    }
}
```

### withCondition
```javascript
withCondition((props, key) => /* ... */)
```
This is a special hook that can be used inside actions. It sets a condition that will be applied to each (subscribed) Component to determine if it should re-render.

```javascript
import ley, { createStore, createValue, withCondition } from 'ley'

// or createStore...
const selector = createValue(null, {
    select: (prev, next) => {
        withCondition((props) => props.id === prev || props.id === next)
        return next
    }
})

function Row({ id }) {
    return <div class={selector() === id ? "selected" : ""}>
        <span onClick={() => selector.select(id)}>Id: {id}</span>
    </div>
}

ley(<>
    <Row id={1} />
    <Row id={2} />
    <Row id={3} />
</>)
```

## Router
- router.name - The name of the route that matches the current path.
- router.path - The current path.
- router.params - Dynamic params (regex named capturing groups).
- router.query - Query parameters from the current URL (after `?`).
- router.hash - The fragment from the current URL (including `#`).
- router.from - The name of the previous route.
- [router.define()](#routerdefine)
- [router.go()](#routergo)

```javascript
import ley from 'ley'
import router from 'ley/router'

router.define({
	home: /^\/$/i,
	about: /^\/about$/i,
})

function App() {
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
	home: /^\/$/i,
	user: /^\/user\/(?<username>.*)$/i, // router.params.username
})
```
#### router.go()
Navigates programmatically.
```javascript
router.go('/about')
router.go('/about', () => window.scrollTo(0, 0))
```

## I18n
- i18n.code - The current language code.
- i18n.locale - Reference to the current locale object.
- i18n.plural - Reference to the current locale plural rule (function).
- [i18n.define()](#i18ndefine)
- [i18n.setLocale()](#i18nsetlocale)
- [Locales list](#locales-list)
- [Configuration](#configuration)
- [Formatting](#formatting)
```javascript
import ley from 'ley'
import i18n, { t } from 'ley/i18n'

const en = { message: { hello: 'Hello!' } }
const ro = { message: { hello: 'Bună!' } }

i18n.define({
    'en-US': en,
    'ro-RO': ro
})

function App() {
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
Sets the locale by the __defined__ language code. Also updates the `lang` attribute of the `<html>` tag.
```javascript
i18n.setLocale('en')
```

### Locales list
```javascript
import i18n, { getLocales } from 'ley/i18n'

i18n.define({
    'en-US': { $: { name: "English" } },
    'ro-RO': {}
})

console.log(getLocales())
```
```
[
    [ "en-US", "English" ],
    [ "ro-RO", "" ] 
]
```

### Configuration
The config object must be assigned to the reserved property `$` of the locale object.

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

## API client
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
    .success((data) => {
        console.log(data.title)
        console.log(data.author)
    })
    .fail((response) => {
        console.log("Couldn't find the book.")
    })
    .error((response) => {
        console.log("An error occured. Please try again later.")
    })

// api.get('https://example.com/api/...')
// api.get('//example.com/api/...')
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
api.get('/endpoint') // returns a modified Promise
    .progress((event) => {
        // XMLHttpRequest progress event
    })
    .success((data) => { // note the "data" argument for this handler
        // XMLHttpRequest load event
        // status 2xx
    })
    .fail((response) => {
        // XMLHttpRequest load event
        // status 4xx
    })
    .error((response) => {
        // XMLHttpRequest error/timeout/load event
        // status != 2xx && status != 4xx
        // (+) When .fail() isn't set, .error() handles failed requests
    })
    .always((response) => {
        // XMLHttpRequest loadend event
        // Fires after .abort() call
        // (+) When .fail/error() isn't set, .awlays() prevents Promise rejection
    })

// Event handler argument types:
// a) response = {data: ..., status: ...}
// b) data === response.data

// Event handlers execution precedence:
// 1) .fail()
// 2) .error()
// 3) .success()
// 4) .always()
// 5) Promise.reject() - unhandled errors and .always() not set
// 6) Promise.resolve() - no errors, or errors handled with .always()
```

### Multiple requests (concurrently and/or sequentially)
```javascript
const handler = api

    // CONCURRENT REQUESTS:

    // Run request #1
    .get('/todos/1')
    // Set progress event handler for request #1
    .progress(event => console.log('Progress Todo: ', event))

    // Run request #2
    .get('/posts/123') 
    // Set progress event handler for request #2
    .progress(event => console.log('Progress Post: ', event))

    // Set event handlers for previously chained requests
    // (these handlers will execute only after all requests finished)
    .success((todo, post) => {
        todo && console.log('Success Todo: ', todo.title)
        post && console.log('Success Post: ', post.title)
        // When a value is returned from .success(),
        // it is passed to the next .then()
        return [todo?.title, post?.title]
    })
    .fail((res1, res2) => {
        res1 && console.log('Invalid Todo: ', res1.data, res1.status)
        res2 && console.log('Invalid Post: ', res2.data, res2.status)
    })
    .error((res1, res2) => {
        res1 && console.log('Error loading Todo: ', res1.data, res1.status)
        res2 && console.log('Error loading Post: ', res2.data, res2.status)
    })
    .always((res1, res2) => {
        if (!res1 && !res2) return console.log('All requests aborted!')
        console.log('Whether success or not...')
        // When a value is returned from .always(),
        // it is passed to the next .then() ONLY IF
        // .success() did NOT already return a value
        return [res1?.data.title, res2?.data.title] // ignored
    })

    // SEQUENTIAL REQUESTS (in relation to previous ones):

    // Here the argument represents the returned
    // value from .success(). (!) Note that the default
    // argument value is an Array of responses [res1, res2, ...]
    .then(([todoT, postT]) => {
        if (!todoT && !postT) return
        return api
            .post('/todos/1', {title: todoT + ' [seen]'})
            .post('/posts/123', {title: postT + ' [seen]'})
            .always(_=>{})
    })
    .then(/*...*/)
    
    .catch((responses) => {
        console.log('At least one unhandled error in', responses)
    })

// handler.abort() // Abort all requests if needed
```

### Cancellation
```javascript
const handler = api.get('/books?id=1')

// Something happened ...
handler.abort()
```

## Pre-rendering (SSR)
### General idea
1. Compile at build time a static HTML page for each defined route
2. On the server, match the route and serve corresponding static HTML
4. Hydrate on the client side

<!--A template engine can be used on the server side to include the data. This can be achieved by first setting the initial state values to template variables in the application:
```javascript
const [title, setTitle] = useState('{{article.title}}')
```-->

### Guide
#### 1. Replace `ley()` with `hydrate()` in `index.jsx`
```javascript
import hydrate, { isBrowser } from 'ley/hydrate'
import router from 'ley/router'
import App from './App/App'

router.define({
	home: /^\/$/i,
	about: /^\/about$/i,
	product: /^\/(?<product>[\w\d]+)$/i,
})

hydrate(<App/>, isBrowser && document.getElementById("app"))
```

####  2. Build the script
```
npm run build
```
####  3. Run the script to get the `routes` object
Example of running the script with node.js:
```javascript
const path = require('path')
const { execSync } = require('child_process')

const distPath = path.resolve(__dirname, './dist')
const result = execSync(`node ${distPath}/main.js`).toString()
const routes = JSON.parse(result)
```
Example of the resulting `routes` object:
```javascript
{   
    // Defined routes
    home: {
        regex: { source: '^\/$', flags: 'i' },
        dom: {
            title: 'Home page',
            meta: '<meta name="description" content="App home page.">',
            schema: '<script type="application/ld+json">{"@context":"https://schema.org/"}</script>',
            content: '<h1>Welcome to the Home page.</h1>'
        }
    },
    about: {
        regex: { source: '^\/about$', flags: 'i' },
        dom: { /* ... */ }
    },
    product: {
        regex: { source: '^\/(?<product>[\w\d]+)$', flags: 'i' },
        dom: { /* ... */ }
    },

    // Additional empty key for mismatch case (when router.name === '')
    "": { 
        regex: { source: '(?:)', flags: '' },
        dom: {
            title: 'Not found',
            meta: '',
            schema: '',
            content: '<b>Error 404<b/> Page not found.'
        }
    }
}

// If i18n was used
{   
    home: {
        regex: /* ... */,
        dom: {
            'en': { title: 'Home page', /* ... */ },
            'ro': { title: 'Pagina principală', /* ... */ },
        }
    },
    /* ... */
}
```
####  4. Save the content of the `routes` object on the server
```javascript
const fs = require('fs')

fs.writeFileSync(`${serverPath}/routes.json`, JSON.stringify(routes))
```

####  5. Set up the server to serve the HTML of the corresponding route

### Final example
`index.html` – The main HTML template.
```html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="/">
    {{title}}
    {{meta}}
    {{schema}}
    <script defer src="/{{bundle}}"></script>
</head>
<body>
    <div id="app">{{content}}</div>
</body>
</html>
```
`webpack.config.js` – Webpack config with a custom plugin, that automatically runs the script after emit, compiles static HTML page for each route using the same template and saves the result on the server in a single `routes.json` file.
```javascript
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const outputPath = path.resolve(__dirname, './dist')
const outputFile = 'js/main.js'
const serverPath = path.resolve(__dirname, '../server')
const templateFile = path.resolve(__dirname, './index.html')
const template = fs.readFileSync(templateFile).toString()
const render = require("handlebars").compile(template, { noEscape: true })

const compilePlugin = {
    apply: compiler => compiler.hooks.afterEmit.tap('MyRenderPlugin', (compilation) => {
        const bundle = compilation.getAssets().find(a => a.name.startsWith(outputFile)).name
        const result = execSync(`node ${outputPath}/${outputFile}`).toString()
        const routes = JSON.parse(result)

        // Render static HTML page for each route (and locale) using
        // "Handlebars" package and the "index.html" template
        for (const name in routes) {
            const route = routes[name]
            const dom = route.dom

            if ('content' in dom) {
                // For convenience, assign the compiled static HTML
                // to the "dom" property of the `route` object
                route.dom = render({ bundle, ...dom })
                continue
            }

            // If i18n was used
            for (const locale in dom) {
                route.dom[locale] = render({ bundle, ...dom[locale] })
            }
        }

        // Store the `routes` object on the server
        fs.writeFileSync(`${serverPath}/routes.json`, JSON.stringify(routes))
    })
}

module.exports = {
    /* ... */,
    plugins: [ compilePlugin, ]
}
```
`index.php` – The server matches the current request URL path against the regex of each route until finds and returns the corresponding static HTML page. The hydration will happen on the client side.
```php
<?php
$routes = json_decode(file_get_contents("./routes.json"), true);
$path = strtok($_SERVER["REQUEST_URI"], '?');

foreach ($routes as $name => $route) {
    $regex = $route['regex'];
    $pattern = "/{$regex['source']}/{$regex['flags']}";
    if (preg_match($pattern, $path)) {
        echo $route['dom'];
        break;
    }
}
```