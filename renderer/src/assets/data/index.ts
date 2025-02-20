import fnv1a from '@sindresorhus/fnv1a'
import type { BaseType, DropEntry, Stat, StatMatcher, TranslationDict } from './interfaces'
import { AppConfig } from '@/web/Config'

export * from './interfaces'

export let ITEM_DROP: DropEntry[]
export let CLIENT_STRINGS: TranslationDict
export let CLIENT_STRINGS_REF: TranslationDict

export let ITEM_BY_TRANSLATED = (ns: BaseType['namespace'], name: string): BaseType[] | undefined => undefined
export let ITEM_BY_REF = (ns: BaseType['namespace'], name: string): BaseType[] | undefined => undefined
export let ITEMS_ITERATOR = function * (includes: string, andIncludes?: string[]): Generator<BaseType> {}

export let STAT_BY_MATCH_STR = (name: string): { matcher: StatMatcher, stat: Stat } | undefined => undefined
export let STAT_BY_REF = (name: string): Stat | undefined => undefined
export let STATS_ITERATOR = function * (includes: string, andIncludes?: string[]): Generator<Stat> {}

function dataBinarySearch (data: Uint32Array, value: number, rowOffset: number, rowSize: number) {
  let left = 0
  let right = (data.length / rowSize) - 1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const midValue = data[(mid * rowSize) + rowOffset]
    if (midValue < value) {
      left = mid + 1
    } else if (midValue > value) {
      right = mid - 1
    } else {
      return mid
    }
  }
  return -1
}

function ndjsonFindLines<T> (ndjson: string) {
  // it's preferable that passed `searchString` has good entropy
  return function * (searchString: string, andIncludes: string[] = []): Generator<T> {
    let start = 0
    while (start !== ndjson.length) {
      const matchPos = ndjson.indexOf(searchString, start)
      if (matchPos === -1) break
      // works for first line too (-1 + 1 = 0)
      start = ndjson.lastIndexOf('\n', matchPos) + 1
      const end = ndjson.indexOf('\n', matchPos)
      const jsonLine = ndjson.slice(start, end)
      if (andIncludes.every(str => jsonLine.includes(str))) {
        yield JSON.parse(jsonLine) as T
      }
      start = end + 1
    }
  }
}

async function loadItems (language: string) {
  const ndjson = await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items.ndjson`)).text()
  const INDEX_WIDTH = 2
  const indexNames = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items-name.bin`)).arrayBuffer())
  const indexRefNames = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items-ref.bin`)).arrayBuffer())

  function commonFind (index: Uint32Array, prop: 'name' | 'refName') {
    return function (ns: BaseType['namespace'], name: string): BaseType[] | undefined {
      let start = dataBinarySearch(index, Number(fnv1a(`${ns}::${name}`, { size: 32 })), 0, INDEX_WIDTH)
      if (start === -1) return undefined
      start = index[start * INDEX_WIDTH + 1]
      const out: BaseType[] = []
      while (start !== ndjson.length) {
        const end = ndjson.indexOf('\n', start)
        const record = JSON.parse(ndjson.slice(start, end)) as BaseType
        if (record.namespace === ns && record[prop] === name) {
          out.push(record)
          if (!record.disc && !record.unique) break
        } else { break }
        start = end + 1
      }
      return out
    }
  }

  ITEM_BY_TRANSLATED = commonFind(indexNames, 'name')
  ITEM_BY_REF = commonFind(indexRefNames, 'refName')
  ITEMS_ITERATOR = ndjsonFindLines<BaseType>(ndjson)
}

async function loadStats (language: string) {
  const ndjson = await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats.ndjson`)).text()
  const INDEX_WIDTH = 2
  const indexRef = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats-ref.bin`)).arrayBuffer())
  const indexMatcher = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats-matcher.bin`)).arrayBuffer())

  STAT_BY_REF = function (ref: string) {
    let start = dataBinarySearch(indexRef, Number(fnv1a(ref, { size: 32 })), 0, INDEX_WIDTH)
    if (start === -1) return undefined
    start = indexRef[start * INDEX_WIDTH + 1]
    const end = ndjson.indexOf('\n', start)
    return JSON.parse(ndjson.slice(start, end))
  }

  STAT_BY_MATCH_STR = function (matchStr: string) {
    let start = dataBinarySearch(indexMatcher, Number(fnv1a(matchStr, { size: 32 })), 0, INDEX_WIDTH)
    if (start === -1) return undefined
    start = indexMatcher[start * INDEX_WIDTH + 1]
    const end = ndjson.indexOf('\n', start)
    const stat = JSON.parse(ndjson.slice(start, end)) as Stat

    const matcher = stat.matchers.find(m =>
      m.string === matchStr || m.advanced === matchStr)
    if (!matcher) {
      // console.log('fnv1a32 collision')
      return undefined
    }
    return { stat, matcher }
  }

  STATS_ITERATOR = ndjsonFindLines<Stat>(ndjson)
}

// assertion, to avoid regressions in stats.ndjson
const DELAYED_STAT_VALIDATION = new Set<string>()
export function stat (text: string) {
  DELAYED_STAT_VALIDATION.add(text)
  return text
}

;(async function initData () { /* eslint-disable no-lone-blocks */
  const { language } = AppConfig()

  {
    await loadItems(language)
    await loadStats(language)

    for (const text of DELAYED_STAT_VALIDATION) {
      if (STAT_BY_REF(text) == null) {
        throw new Error(`Cannot find stat: ${text}`)
      }
    }
    DELAYED_STAT_VALIDATION.clear()
  }

  { /* eslint-disable no-eval */
    CLIENT_STRINGS = (await import(/* @vite-ignore */`${import.meta.env.BASE_URL}data/${language}/client_strings.js`)).default
    CLIENT_STRINGS_REF = (await import(/* @vite-ignore */`${import.meta.env.BASE_URL}data/en/client_strings.js`)).default
    ITEM_DROP = await (await fetch(`${import.meta.env.BASE_URL}data/item-drop.json`)).json()
  }
})()
