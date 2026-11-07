import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { normalizePinyin } from './pinyinUtils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env') })

const toneMap = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

const vowelOrder = ['a', 'e', 'o', 'i', 'u', 'v']

function convertUColon(syl) {
  return syl.replace(/u:([0-9]|$)/g, (m, c) => 'v' + c)
}

function hasUpperCase(str) {
  return str !== str.toLowerCase()
}

function convertSyllable(syllable) {
  let s = convertUColon(syllable)
  const match = s.match(/^([A-Za-zv]*)(\d)(.*)$/)
  if (!match) return s

  let prefix = match[1]
  const wasCapitalized = prefix.length > 0 && prefix[0] === prefix[0].toUpperCase() && prefix[0] !== prefix[0].toLowerCase()
  const lowerPrefix = prefix.toLowerCase()
  const tone = parseInt(match[2])
  const suffix = match[3]

  if (tone === 5 || tone === 0) return prefix + suffix

  for (const v of vowelOrder) {
    if (lowerPrefix.includes(v)) {
      const idx = lowerPrefix.lastIndexOf(v)
      const toneChar = toneMap[v][tone - 1]
      const before = prefix.slice(0, idx)
      const after = prefix.slice(idx + 1)
      const result = before + toneChar + after + suffix
      return wasCapitalized ? result.charAt(0).toUpperCase() + result.slice(1) : result
    }
  }

  return s
}

function convertPinyin(pinyin) {
  return pinyin
    .split(' ')
    .map(s => convertSyllable(s))
    .join(' ')
}

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'zihai.db')
const db = new Database(DB_PATH)

const rows = db.prepare('SELECT id, pinyin FROM words').all()
const update = db.prepare('UPDATE words SET pinyin = ?, pinyin_normalized = ?, pinyin_search = ? WHERE id = ?')

const updateMany = db.transaction((rows) => {
  for (const row of rows) {
    const converted = convertPinyin(row.pinyin)
    const norm = normalizePinyin(converted)
    const search = norm.replace(/v/g, 'u')
    update.run(converted, norm, search, row.id)
  }
})

updateMany(rows)

console.log(`Converted pinyin for ${rows.length} words`)

const numbered = db.prepare("SELECT COUNT(*) as c FROM words WHERE pinyin GLOB '*[0-9]*'").get()
console.log(`Remaining with numbers: ${numbered.c}`)

const colon = db.prepare("SELECT COUNT(*) as c FROM words WHERE pinyin GLOB '*u:*'").get()
console.log(`Remaining with u:: ${colon.c}`)

const sample = db.prepare('SELECT character, pinyin FROM words WHERE character = ? OR character = ? OR character = ?').all('一二九运动', '一带一路', '一女一男')
if (sample.length === 0) {
  const s = db.prepare('SELECT character, pinyin FROM words LIMIT 10').all()
  s.forEach(r => console.log(`${r.character} -> ${r.pinyin}`))
} else {
  sample.forEach(r => console.log(`${r.character} -> ${r.pinyin}`))
}

db.close()
