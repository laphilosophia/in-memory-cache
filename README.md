# in-memory-cache

> Node's event emitter for all engines.

This implements the Node.js in-memory-cache module for environments that do not have it, like browsers.

> `in-memory-cache` currently matches the **Node.js 20.x API.

## Install

```bash
npm install @laphilosophia/in-memory-cache
```

## Usage

```typescript
import MemoryCache, { format } from '@laphilosophia/in-memory-cache'


// format(time: string) function takes parameter as string and converts it to  millisecond
const cache = new Cache({ stdTTL: format("5min") })

// or you can use your own time (ms unit)
// const cache = new Cache({ stdTTL: 18_000 })

const $key = 'cache:key'
if (cache.has($key)) {
  const cached = JSON.parse(cache.get($key))
} else {
  const data = await someAsyncFunction()
  cache.put({
    key: $key,
    value: JSON.stringify(data),
    callback: (key, value) => { /* do some stuff */ }
  })

  return data
}

// also, you can listen to these events (native node:events emitter)

cache.on('put', (key: string, value: any) => {})
cache.on('del', (key: string) => {})
cache.on('clear')
cache.on('expire', (key: string, isExpired: boolean) => {})
cache.on('export', (value: string) => {}) // stringified data object
cache.on('import', (size: number) => {})
```
