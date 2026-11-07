import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { toDisplayPinyin } from './pinyinUtils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'zihai.db')
const db = new Database(DB_PATH)

// Add the new column (IF NOT EXISTS is not supported for ALTER TABLE, so catch the error)
try {
  db.exec("ALTER TABLE words ADD COLUMN pinyin_display TEXT")
  console.log('Added pinyin_display column')
} catch {
  console.log('pinyin_display column already exists')
}

const rows = db.prepare('SELECT id, pinyin FROM words').all()
const update = db.prepare('UPDATE words SET pinyin_display = ? WHERE id = ?')
const updateMany = db.transaction((rows) => {
  for (const row of rows) {
    const display = toDisplayPinyin(row.pinyin)
    update.run(display, row.id)
  }
})
updateMany(rows)
console.log(`Updated pinyin_display for ${rows.length} words`)

const sample = db.prepare("SELECT character, pinyin, pinyin_display FROM words WHERE character IN ('公共','乒乓','中国','一二九运动','一带一路')").all()
console.table(sample)

db.close()
