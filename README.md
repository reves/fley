# _ley_ – Frontend JavaScript Web Framework

* [JSX syntax](https://github.com/facebook/jsx)
* Concurrent Renderer – [Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
* [Hooks](#hooks)
* [Stores – Global States](#store)
* Router
* I18n
* HTTP API Client

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

# Hooks
* [useState](#usestate)
* [useEffect, useLayoutEffect](#useEffect)
* [useRef](#useref)
* [useStore](#usestore)

## useState
```javascript
const [state, setState] = useState(initialValue)
```

## <a id='useEffect'></a> useEffect  `(async)`, useLayoutEffect `(sync)`
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

## useRef
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

## useStore
```javascript
useStore(store)
```
```javascript
function Component() {
    useStore(router)
    return <div>The current route is {router.name}</div>
}
```

# Store
## createStore
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
        // Calls to other methods do not cause additional rendering
        return this.style === 'light'
            ? this.setStyle('dark')
            : this.setStyle('light')
    }

    setStyle(style)
    {
        // Returning "null" prevents rendering
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