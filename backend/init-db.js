import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const DB_PATH = path.join(os.homedir(), 'zihai.db')
const db = new Database(DB_PATH)

const ACCENT_MAP = {
  'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
  'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
  'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
  'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
  'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
  'ǖ': 'u', 'ǘ': 'u', 'ǚ': 'u', 'ǜ': 'u',
  'Ā': 'A', 'Á': 'A', 'Ǎ': 'A', 'À': 'A',
  'Ē': 'E', 'É': 'E', 'Ě': 'E', 'È': 'E',
  'Ī': 'I', 'Í': 'I', 'Ǐ': 'I', 'Ì': 'I',
  'Ō': 'O', 'Ó': 'O', 'Ǒ': 'O', 'Ò': 'O',
  'Ū': 'U', 'Ú': 'U', 'Ǔ': 'U', 'Ù': 'U',
}

function stripPinyin(py) {
  let s = py.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  s = s.replace(/[1-5]/g, '')
  s = s.replace(/\s+/g, '')
  s = s.toLowerCase()
  for (const [accent, plain] of Object.entries(ACCENT_MAP)) {
    s = s.replaceAll(accent, plain)
  }
  return s
}

function hasIdiom(defs) {
  const all = Object.values(defs).join(' ')
  return all.includes('(idiom)')
}

// Legacy words table for server backward compatibility
db.exec(`
  DROP TABLE IF EXISTS words;
  CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character TEXT UNIQUE NOT NULL,
    pinyin TEXT NOT NULL,
    english_definition TEXT NOT NULL,
    hsk_level INTEGER,
    pinyin_search TEXT,
    pinyin_normalized TEXT,
    pinyin_plain TEXT
  );
  CREATE INDEX idx_words_pinyin_normalized ON words(pinyin_normalized);
  CREATE INDEX idx_words_character ON words(character);
  CREATE INDEX idx_words_english_definition ON words(english_definition);
  CREATE INDEX idx_words_pinyin_plain ON words(pinyin_plain);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simplified TEXT UNIQUE NOT NULL,
    traditional TEXT,
    pinyin TEXT NOT NULL,
    pinyin_flat TEXT NOT NULL,
    definition TEXT NOT NULL,
    stroke_count INTEGER,
    radical INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_characters_simplified ON characters(simplified);
  CREATE INDEX IF NOT EXISTS idx_characters_pinyin_flat ON characters(pinyin_flat);

  CREATE TABLE IF NOT EXISTS cedict_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simplified TEXT UNIQUE NOT NULL,
    traditional TEXT,
    pinyin TEXT NOT NULL,
    pinyin_flat TEXT NOT NULL,
    definition TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cedict_words_simplified ON cedict_words(simplified);
  CREATE INDEX IF NOT EXISTS idx_cedict_words_pinyin_flat ON cedict_words(pinyin_flat);
`)

console.log('Fetching CC-CEDICT data...')
const res = await fetch('https://raw.githubusercontent.com/krmanik/cedict-json/master/all_cedict.json')
const data = await res.json()
const entries = Object.values(data)
console.log(`Downloaded ${entries.length} entries`)

let charCount = 0
let wordCount = 0
let skipped = 0

const insertChar = db.prepare(`
  INSERT OR IGNORE INTO characters (simplified, traditional, pinyin, pinyin_flat, definition)
  VALUES (?, ?, ?, ?, ?)
`)

const insertWord = db.prepare(`
  INSERT OR IGNORE INTO cedict_words (simplified, traditional, pinyin, pinyin_flat, definition)
  VALUES (?, ?, ?, ?, ?)
`)

// Also insert into the legacy words table for backward compatibility
const insertLegacyWord = db.prepare(`
  INSERT OR IGNORE INTO words (character, pinyin, pinyin_plain, pinyin_normalized, english_definition)
  VALUES (?, ?, ?, ?, ?)
`)

const doInsert = db.transaction((items) => {
  for (const item of items) {
    insertChar.run(...item)
    charCount++
  }
})

const doInsertWords = db.transaction((items) => {
  for (const item of items) {
    insertWord.run(item[0], item[1], item[2], item[3], item[4])
    insertLegacyWord.run(item[0], item[2], item[3], item[3], item[4])
    wordCount++
  }
})

const chars = []
const words = []

for (const entry of entries) {
  const s = entry.simplified
  if (typeof s !== 'string') continue
  if (s.length > 4) { skipped++; continue }
  if (hasIdiom(entry.definitions)) { skipped++; continue }

  const pinyinStr = Array.isArray(entry.pinyin) ? entry.pinyin.join(' ') : ''
  const defStr = Object.values(entry.definitions).join('; ').replace(/;\s*$/, '')
  const pinyinFlat = stripPinyin(pinyinStr)
  const traditional = entry.traditional || s

  if (s.length === 1) {
    chars.push([s, traditional, pinyinStr, pinyinFlat, defStr])
  } else if (s.length >= 2 && s.length <= 4) {
    words.push([s, traditional, pinyinStr, pinyinFlat, defStr])
  }
}

console.log(`Processing ${chars.length} characters and ${words.length} words...`)

doInsert(chars)
doInsertWords(words)

console.log(`Inserted ${charCount} characters, ${wordCount} words, skipped ${skipped}`)

db.close()
