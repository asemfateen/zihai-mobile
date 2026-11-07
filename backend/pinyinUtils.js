import { PINYIN_SYLLABLES } from './pinyinSyllables.js'

const SYLLABLES_SORTED = [...PINYIN_SYLLABLES].sort((a, b) => b.length - a.length)

export function normalizePinyin(pinyin) {
  const toneMap = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
  }

  const numToneMap = {
    a: ['ā', 'á', 'ǎ', 'à'],
    e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
  }

  const vowelOrder = ['a', 'e', 'o', 'i', 'u', 'v']

  function convertUColon(s) {
    return s.replace(/u:([0-9]|$)/g, (m, c) => 'v' + c)
  }

  pinyin = convertUColon(pinyin)

  const numberedMatch = pinyin.match(/^[A-Za-z]+\d/)
  if (numberedMatch) {
    const syllables = pinyin.split(' ')
    const converted = syllables.map(syl => {
      const m = syl.match(/^([A-Za-zv]*)(\d)(.*)$/)
      if (!m) return syl
      const prefix = m[1], tone = parseInt(m[2]), suffix = m[3]
      if (tone === 5 || tone === 0) return prefix + suffix
      const lowerPrefix = prefix.toLowerCase()
      for (const v of vowelOrder) {
        if (lowerPrefix.includes(v)) {
          const idx = lowerPrefix.lastIndexOf(v)
          return prefix.slice(0, idx) + numToneMap[v][tone - 1] + prefix.slice(idx + 1) + suffix
        }
      }
      return syl
    })
    pinyin = converted.join(' ')
  }

  const normalized = pinyin
    .toLowerCase()
    .split('')
    .map(ch => toneMap[ch] || ch)
    .join('')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

export function searchNormalizePinyin(pinyin) {
  const normalized = normalizePinyin(pinyin)
  return normalized.replace(/v/g, 'u')
}

export function toDisplayPinyin(pinyin) {
  if (!pinyin) return ''
  const toneMap = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
  }
  const reverseToneMap = {
    'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì',
    'o': 'ōóǒò', 'u': 'ūúǔù', 'v': 'ǖǘǚǜ',
  }
  const vowelOrder = ['a', 'e', 'o', 'i', 'u', 'v']

  let s = pinyin.replace(/u:([1-5]|$)/g, (m, c) => 'v' + c)
  const syllables = s.split(' ')
  const converted = syllables.map(syl => {
    if (!syl) return syl
    if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(syl)) return syl
    const m = syl.match(/^([A-Za-z]+)([1-5])$/i)
    if (!m) return syl
    const prefix = m[1], tone = parseInt(m[2])
    if (tone === 5) return prefix
    const lowerPrefix = prefix.toLowerCase()
    for (const v of vowelOrder) {
      if (lowerPrefix.includes(v)) {
        const idx = lowerPrefix.lastIndexOf(v)
        const toneChar = reverseToneMap[v][tone - 1]
        const wasCapitalized = prefix[0] !== prefix[0].toLowerCase()
        const before = prefix.slice(0, idx)
        const after = prefix.slice(idx + 1)
        const result = before + toneChar + after
        return wasCapitalized ? result.charAt(0).toUpperCase() + result.slice(1) : result
      }
    }
    return syl
  })
  return converted.join(' ')
}

const CONSONANT_MAP = {
  'c': ['s'],
  's': ['c', 'sh'],
  'sh': ['s'],
  'z': ['zh'],
  'zh': ['z'],
  'ch': ['c', 'q'],
  'r': ['l'],
  'l': ['r', 'n'],
  'n': ['l'],
  'b': ['p'],
  'p': ['b'],
  'd': ['t'],
  't': ['d'],
  'g': ['k'],
  'k': ['g'],
  'j': ['q', 'x'],
  'q': ['j', 'ch', 'x'],
  'x': ['j', 'q', 'sh'],
}

export function generatePinyinAlternatives(input) {
  const normalized = normalizePinyin(input)
  const primary = splitPinyin(normalized)
  const seen = new Set([primary])
  const alternatives = [primary]

  const syllables = primary.split(' ')
  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i]
    for (const [from, toList] of Object.entries(CONSONANT_MAP)) {
      if (syl.startsWith(from)) {
        for (const to of toList) {
          const alt = [...syllables]
          alt[i] = to + syl.slice(from.length)
          const joined = alt.join(' ')
          if (!seen.has(joined)) {
            seen.add(joined)
            alternatives.push(joined)
          }
        }
      }
    }
  }

  return alternatives
}

export function splitPinyin(input) {
  const s = input.toLowerCase()
  const result = []
  let i = 0
  while (i < s.length) {
    let matched = false
    for (const syl of SYLLABLES_SORTED) {
      if (s.startsWith(syl, i)) {
        result.push(syl)
        i += syl.length
        matched = true
        break
      }
    }
    if (!matched) {
      result.push(s[i])
      i++
    }
  }
  return result.join(' ')
}


