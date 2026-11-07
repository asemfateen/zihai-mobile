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
  console.error('Run with --execute to perform the actual insertion.')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

if (isDryRun) {
  console.log(`[DRY-RUN] Would load ${data.length} words into ${dbPath}`)
  console.log('Run with --execute flag to perform the actual insertion.')
  process.exit(0)
}

const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character TEXT UNIQUE NOT NULL,
    pinyin TEXT NOT NULL,
    english_definition TEXT NOT NULL,
    hsk_level INTEGER,
    pinyin_search TEXT,
    pinyin_normalized TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_words_pinyin_normalized ON words(pinyin_normalized);
  CREATE INDEX IF NOT EXISTS idx_words_character ON words(character);
`)

const insert = db.prepare(`
  INSERT INTO words (character, pinyin, english_definition, hsk_level, pinyin_search, pinyin_normalized)
  VALUES (@character, @pinyin, @english_definition, @hsk_level, @pinyin_search, @pinyin_normalized)
  ON CONFLICT(character) DO NOTHING
`)

const insertMany = db.transaction((words) => {
  for (const word of words) {
    const pinyin = word.pinyin || ''
    insert.run({
      character: word.simplified,
      pinyin,
      english_definition: word.primaryDefinition || '',
      hsk_level: word.hskLevel || null,
      pinyin_search: normalizePinyin(pinyin).replace(/v/g, 'u'),
      pinyin_normalized: normalizePinyin(pinyin),
    })
  }
})

insertMany(data)

console.log(`Inserted ${data.length} words into zihai.db`)

const sample = db.prepare('SELECT character, pinyin_normalized FROM words LIMIT 5').all()
console.log('Sample normalized pinyin:')
sample.forEach(r => console.log(`  ${r.character} -> ${r.pinyin_normalized}`))

db.close()
