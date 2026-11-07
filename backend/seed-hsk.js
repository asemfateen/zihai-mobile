import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const DB_PATH = process.env.DB_PATH || path.join(path.dirname(fileURLToPath(import.meta.url)), 'zihai.db')
const db = new Database(DB_PATH)

try {
  db.exec('ALTER TABLE characters ADD COLUMN hsk_level INTEGER DEFAULT 0')
} catch {
  // column already exists
}

try {
  db.exec('ALTER TABLE cedict_words ADD COLUMN hsk_level INTEGER DEFAULT 0')
} catch {
  // column already exists
}

const LEVELS = 6
const BASE = 'https://raw.githubusercontent.com/clem109/hsk-vocabulary/master/hsk-vocab-json'

console.log('Fetching HSK vocabulary data...')
const allWords = []

for (let level = 1; level <= LEVELS; level++) {
  const url = `${BASE}/hsk-level-${level}.json`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Failed to fetch HSK level ${level}: ${res.status}`)
    continue
  }
  const data = await res.json()
  for (const entry of data) {
    allWords.push({ hanzi: entry.hanzi, level })
  }
}

console.log(`Downloaded ${allWords.length} HSK words across ${LEVELS} levels`)

const updateChar = db.prepare('UPDATE characters SET hsk_level = ? WHERE simplified = ?')
const updateWord = db.prepare('UPDATE cedict_words SET hsk_level = ? WHERE simplified = ?')

let charUpdates = 0
let wordUpdates = 0

db.transaction(() => {
  for (const { hanzi, level } of allWords) {
    const c = updateChar.run(level, hanzi)
    charUpdates += c.changes
    const w = updateWord.run(level, hanzi)
    wordUpdates += w.changes
  }
})()

console.log(`Updated ${charUpdates} characters and ${wordUpdates} words with HSK levels`)
db.close()
