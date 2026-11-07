import Database from 'better-sqlite3'
import readline from 'readline'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'zihai.db')
const CEDICT_PATH = path.join(__dirname, '..', 'data', 'raw', 'cedict_ts.u8')

const db = new Database(DB_PATH)

const lineRegex = /^(\S+)\s(\S+)\s\[(.+?)\]\s\/(.*)\/$/

const insert = db.prepare(`
  INSERT INTO dictionary (traditional, simplified, pinyin, definitions)
  VALUES (?, ?, ?, ?)
`)

const countStmt = db.prepare('SELECT COUNT(*) AS cnt FROM dictionary')

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    insert.run(row.traditional, row.simplified, row.pinyin, row.definitions)
  }
})

const rl = readline.createInterface({
  input: fs.createReadStream(CEDICT_PATH, { encoding: 'utf8' }),
  crlfDelay: Infinity,
})

let batch = []
let total = 0
const BATCH_SIZE = 1000

console.log('Starting CC-CEDICT import...')

for await (const line of rl) {
  if (line.startsWith('#') || line.trim().length === 0) continue

  const match = line.match(lineRegex)
  if (!match) continue

  const traditional = match[1]
  const simplified = match[2]
  const pinyin = match[3]
  const definitions = match[4]

  batch.push({ traditional, simplified, pinyin, definitions })
  total++

  if (batch.length >= BATCH_SIZE) {
    insertMany(batch)
    batch = []
    process.stdout.write(`\rImported ${total} entries...`)
  }
}

if (batch.length > 0) {
  insertMany(batch)
}

const { cnt } = countStmt.get()
console.log(`\nImport complete! Total entries in dictionary: ${cnt}`)

db.close()
