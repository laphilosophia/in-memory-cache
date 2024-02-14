export type CacheItem = {
  expire: number
  value: unknown
  timeout: string | number | NodeJS.Timeout | undefined
}

export type CacheObject = Map<string, CacheItem>

export type NewCache = {
  key: string
  value: unknown
  callback?: (key: string, value: unknown) => void
}
