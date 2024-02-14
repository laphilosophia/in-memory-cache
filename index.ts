import { EventEmitter } from 'node:events'
import type { CacheObject, NewCache } from './types'

export function format(time: string) {
  let result = 0

  const keys = ['s', 'sec', 'second', 'm', 'min', 'minute', 'h', 'hr', 'hour']

  const exist = keys.some((key) => time.endsWith(key))
  const param = keys.find((key) => time.endsWith(key))

  if (!exist || !param) return result

  const number = parseFloat(time.substring(0, time.length - param.length))

  switch (param) {
    case 's':
    case 'sec':
    case 'second':
      result = number
      break
    case 'm':
    case 'min':
    case 'minute':
      result = number * 60
      break
    case 'h':
    case 'hr':
    case 'hour':
      result = number * 3600
      break

    default:
      result = 0
      break
  }

  return result
}

export default class MemoryCache extends EventEmitter {
  private $cache: CacheObject
  private $hitCount: number
  private $missCount: number
  private $size: number
  private $debug: boolean
  ttl: string | number

  constructor({ ttl }: { ttl: number }) {
    super()

    this.$cache = new Map()
    this.$hitCount = 0
    this.$missCount = 0
    this.$size = 0
    this.$debug = false
    this.ttl = ttl
  }

  private $del(key: string) {
    this.$size--
    this.$cache.delete(key)
  }

  public keys() {
    return this.$cache.keys()
  }

  public has(key: string) {
    if (this.$cache.has(key)) {
      const record = this.$cache.get(key)

      if (this.$debug) {
        console.debug(record)
      }

      if (isNaN(record!.expire) || record!.expire >= Date.now()) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }

  public get(key: string) {
    if (this.$cache.has(key)) {
      const record = this.$cache.get(key)

      if (isNaN(record!.expire) || record!.expire >= Date.now()) {
        if (this.$debug) {
          this.$hitCount++
        }

        return record!.value
      } else {
        if (this.$debug) {
          this.$missCount++
        }

        this.$size--
        this.$cache.delete(key)
      }
    } else if (this.$debug) {
      this.$missCount++
    }

    return null
  }

  public put({ key, value, callback }: NewCache) {
    const t = typeof this.ttl === 'string' ? format(this.ttl || '10sec') : this.ttl
    if (this.$debug) {
      console.debug(
        `caching: ${key} => ${value} (${this.ttl}${typeof this.ttl === 'string' ? '' : 'ms'})`
      )
    }

    if (typeof t !== 'undefined' && (typeof t !== 'number' || isNaN(t) || t <= 0)) {
      throw new Error('Cache timeout must be a positive number')
    } else if (typeof callback !== 'undefined' && typeof callback !== 'function') {
      throw new Error('Cache timeout callback must be a function')
    }

    if (this.$cache.has(key)) {
      const oldRecord = this.$cache.get(key)

      clearTimeout(oldRecord!.timeout)
    } else {
      this.$size++
    }

    const record = {
      value: value,
      expire: (t || 0) + Date.now(),
      timeout: setTimeout(() => {}, 0),
    }

    if (!isNaN(record.expire)) {
      record.timeout = setTimeout(() => {
        this.$del(key)

        if (callback) {
          callback(key, value)
        }
      }, t)
    }

    this.$cache.set(key, record)
    this.emit('put', key, value)

    return value
  }

  public del(key: string) {
    let canDelete = true

    if (this.$cache.has(key)) {
      const oldRecord = this.$cache.get(key)

      clearTimeout(oldRecord!.timeout)

      if (!isNaN(oldRecord!.expire) || oldRecord!.expire < Date.now()) {
        canDelete = false
      }
    } else {
      canDelete = false
    }

    if (canDelete) {
      this.$del(key)
      this.emit('del', key)
    }

    return canDelete
  }

  public clear() {
    for (const [i] of this.$cache) {
      clearTimeout(this.$cache.get(i)?.timeout)
    }

    this.$size = 0
    this.$cache = new Map()
    this.emit('clear')

    if (this.$debug) {
      this.$hitCount = 0
      this.$missCount = 0
    }
  }

  public size() {
    return this.$size
  }

  public memsize() {
    let size = 0

    for (const [] of this.$cache) {
      size++
    }

    return size
  }

  public debug(bool: boolean) {
    this.$debug = bool
  }

  public hits() {
    return this.$hitCount
  }

  public expired(key: string, second: number) {
    if (this.$cache.has(key)) {
      const record = this.$cache.get(key)
      this.emit('expire', key, true)
      return (Date.now() - record!.expire) / 1000 >= second
    } else {
      this.emit('expire', key, false)
      return false
    }
  }

  public misses() {
    return this.$missCount
  }

  public export() {
    const plainJSCache: CacheObject = new Map()

    for (const [key] of this.$cache) {
      const record = this.$cache.get(key)

      plainJSCache.set(key, {
        value: record?.value,
        // @ts-expect-error JSON doesn't support NaN, so convert it to 'NaN'.
        expire: record?.expire || 'NaN',
      })
    }

    this.emit('export', JSON.stringify(plainJSCache))
    return JSON.stringify(plainJSCache)
  }

  public import(jsonToImport: string, options: { skipDuplicates: boolean }) {
    const cacheToImport: CacheObject = JSON.parse(jsonToImport)
    const currTime = Date.now()

    const skipDuplicates = options && options.skipDuplicates

    for (const [key] of cacheToImport) {
      if (skipDuplicates) {
        if (this.$cache.has(key)) {
          if (this.$debug) {
            console.debug(`Skipping duplicate imported key '${key}'`)
          }

          continue
        }
      }

      if (!cacheToImport.has(key)) {
        throw new Error('No cache record found when trying to import!')
      }

      const record = cacheToImport.get(key)

      // record.expire could be `'NaN'` if no expiry was set.
      // Try to subtract from it; a string minus a number is `NaN`, which is perfectly fine here.
      let remainingTime: number | string | undefined = record!.expire - currTime

      if (remainingTime <= 0) {
        // Delete any record that might exist with the same key, since this key is expired.
        this.$del(key)
        continue
      }

      // Remaining time must now be either positive or `NaN`,
      // but `put` will throw an error if we try to give it `NaN`.
      remainingTime = remainingTime > 0 ? remainingTime : undefined

      this.ttl = remainingTime || this.ttl

      this.put({ key, value: record?.value })
    }

    this.emit('import', this.size())
    return this.size()
  }
}
