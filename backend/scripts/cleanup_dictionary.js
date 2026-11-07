import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'zihai.db')
const db = new Database(DB_PATH)

const beforeCount = db.prepare('SELECT COUNT(*) AS cnt FROM dictionary').get().cnt
console.log(`Starting count: ${beforeCount}`)

const deleteLengthResult = db.prepare(
  `DELETE FROM dictionary WHERE LENGTH(simplified) > 10 OR LENGTH(traditional) > 10`
).run()
console.log(`Deleted ${deleteLengthResult.changes} rows where character length > 10`)

const remaining = db.prepare('SELECT id, simplified, traditional FROM dictionary').all()

const hanRegex = /^[\p{Script=Han}]+$/u
const invalidIds = []

for (const row of remaining) {
  if (!hanRegex.test(row.simplified) || !hanRegex.test(row.traditional)) {
    invalidIds.push(row.id)
  }
}

if (invalidIds.length > 0) {
  const deleteInvalid = db.transaction((ids) => {
    const stmt = db.prepare('DELETE FROM dictionary WHERE id = ?')
    for (const id of ids) {
      stmt.run(id)
    }
  })
  deleteInvalid(invalidIds)
  console.log(`Deleted ${invalidIds.length} rows containing non-Chinese characters`)
} else {
  console.log('Deleted 0 rows containing non-Chinese characters')
}

const afterCount = db.prepare('SELECT COUNT(*) AS cnt FROM dictionary').get().cnt
console.log(`Final count: ${afterCount}`)
console.log(`Total removed: ${beforeCount - afterCount}`)

db.close()
