import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { normalizePinyin } from './pinyinUtils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env') })

const dbPath = process.env.DB_PATH || path.join(os.homedir(), 'zihai.db')
const jsonPath = path.resolve(__dirname, '../src/assets/data/dictionary.json')

const isExecute = process.argv.includes('--execute')
const isDryRun = !isExecute

if (!fs.existsSync(jsonPath)) {
  console.error(`Dictionary file not found at: ${jsonPath}`)
  console.error('Place your dictionary JSON file at assets/data/dictionary.json')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

const db = new Database(dbPath)

const existing = db.prepare('SELECT character FROM words').all()
const existingSet = new Set(existing.map(r => r.character))

const insert = db.prepare(`
  INSERT INTO words (character, pinyin, english_definition, hsk_level, pinyin_search, pinyin_normalized)
  VALUES (@character, @pinyin, @english_definition, @hsk_level, @pinyin_search, @pinyin_normalized)
`)

let restored = 0
let skipped = 0
for (const word of data) {
  if (!word.simplified || !word.primaryDefinition || !word.pinyin) {
    skipped++
    continue
  }
  if (!existingSet.has(word.simplified)) {
    if (isDryRun) {
      restored++
    } else {
      const pinyin = word.pinyin || ''
      insert.run({
        character: word.simplified,
        pinyin,
        english_definition: word.primaryDefinition || '',
        hsk_level: word.hskLevel || null,
        pinyin_search: normalizePinyin(pinyin).replace(/v/g, 'u'),
        pinyin_normalized: normalizePinyin(pinyin),
      })
      restored++
    }
  }
}

if (skipped > 0) {
  console.log(`Skipped ${skipped} malformed entries (missing required fields)`)
}
console.log(`${isDryRun ? '[DRY-RUN] Would restore' : 'Restored'} ${restored} missing entries from dictionary JSON`)

const stats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN hsk_level IS NULL THEN 1 ELSE 0 END) as no_hsk,
    SUM(CASE WHEN english_definition IS NULL OR english_definition = '' THEN 1 ELSE 0 END) as empty_def
  FROM words
`).get()

console.log(`\nDictionary statistics:`)
console.log(`  Total words: ${stats.total}`)
console.log(`  Without HSK level: ${stats.no_hsk}`)
console.log(`  Empty definitions: ${stats.empty_def}`)

const orphans = db.prepare(`
  SELECT COUNT(*) as count FROM words w
  WHERE NOT EXISTS (SELECT 1 FROM favorites f WHERE f.word_id = w.id)
    AND NOT EXISTS (SELECT 1 FROM list_items li WHERE li.word_id = w.id)
    AND NOT EXISTS (SELECT 1 FROM flashcard_progress fp WHERE fp.word_id = w.id)
`).get()
console.log(`  Orphan words (unused): ${orphans.count}`)

const sample = db.prepare('SELECT character, english_definition FROM words WHERE english_definition IS NULL OR english_definition = \'\' LIMIT 5').all()
if (sample.length > 0) {
  console.log(`\nSample entries missing definitions:`)
  sample.forEach(r => console.log(`  ${r.character} (id: ${r.id})`))
}

if (isDryRun) {
  console.log('\nThis was a dry run. Run with --execute to perform the actual restoration.')
}

db.close()
