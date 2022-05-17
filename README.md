# ley

Frontend JavaScript web framework based on [JSX syntax](https://github.com/facebook/jsx) and concurrent renderer with [Fiber Architecture](https://github.com/acdlite/react-fiber-architecture).

- [Hooks](#hooks)
- [Store (global states)](#store)
- [Router](#router)
- [I18n](#i18n)
- HTTP API Client

## Usage
```javascript
import ley, { useState } from 'ley'

function App() {
    const [count, setCount] = useState(0)
    return <>
        <div>You clicked {count} times</div>
        <button onClick={() => setCount(count + 1)}>+</button>
    </>
}

ley(<App/>) // By default, uses document.body as the root element.
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
- [createStore](#createstore)

A store is an object that contains a global state (properties) and its actions (methods).
### createStore
```javascript
createStore(Class)
```
```javascript
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

function Component() {
    useStore(theme)
    return <>
        <div>The current theme style is {theme.style}</div>
        <button onClick={() => theme.toggleStyle()}>Change theme style</button>
    </>
}
```

## Router

- [router.define()](#routerdefine)
- [router.go()](#routergo)
```javascript
import router from 'ley/router'
import Home from 'Home'
import About from 'About'

router.define({
	home: /\/$/i,
	about: /\/about/i
})

function App() {
    useStore(router)
    return <>
        <nav>
            <a href="/">Home</a>|
            <a href="/about">About Us</a>
        </nav>
        <div>
            { router.name === 'home'
                ? <Home />
                : router.name === 'about'
                    ? <About />
                    : 'Page not found'
            }
        </div>
    </>
}
```
### router.define()
Defines named routes.
```javascript
router.define({
	home: /\/$/i, // name: new RegExp()
})
```
### router.go()
Navigates programmatically.
```javascript
router.go('/about')
```
## I18n
```javascript
import i18n, { t } from 'ley/i18n'
```