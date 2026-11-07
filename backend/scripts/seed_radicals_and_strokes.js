import Database from 'better-sqlite3';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import RADICALS from '../radicals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'zihai.db');
const db = new Database(dbPath);

console.log('--- SEEDING RADICALS & STROKE COUNTS ---');

// 1. Create and populate radicals table
db.exec(`
  CREATE TABLE IF NOT EXISTS radicals (
    id INTEGER PRIMARY KEY,
    character TEXT NOT NULL,
    name TEXT
  );
`);

const insertRadical = db.prepare(`
  INSERT OR REPLACE INTO radicals (id, character, name)
  VALUES (?, ?, ?)
`);

const insertAllRadicals = db.transaction((rads) => {
  for (const r of rads) {
    insertRadical.run(r.id, r.character, r.name);
  }
});

insertAllRadicals(RADICALS);
console.log(`Seeded ${RADICALS.length} Kangxi radicals into radicals table.`);

// 2. Parse Unihan_IRGSources.txt for radical and stroke counts
const unihanPath = path.join(__dirname, '..', 'data', 'raw', 'Unihan', 'Unihan_IRGSources.txt');

if (!fs.existsSync(unihanPath)) {
  console.warn(`Unihan_IRGSources.txt not found at: ${unihanPath}`);
} else {
  console.log('Parsing Unihan_IRGSources.txt for radical numbers and total strokes...');

  const rl = readline.createInterface({
    input: fs.createReadStream(unihanPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const charMap = new Map(); // char -> { radical: number, stroke_count: number }

  for await (const line of rl) {
    if (line.startsWith('#') || line.trim().length === 0) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const [uHex, property, value] = parts;
    const codePoint = parseInt(uHex.replace('U+', ''), 16);
    if (isNaN(codePoint)) continue;

    const char = String.fromCodePoint(codePoint);

    if (!charMap.has(char)) {
      charMap.set(char, {});
    }
    const charData = charMap.get(char);

    if (property === 'kRSUnicode') {
      // Value format: e.g. "38.3" or "38'.3"
      const match = value.match(/^(\d+)/);
      if (match && !charData.radical) {
        charData.radical = parseInt(match[1], 10);
      }
    } else if (property === 'kTotalStrokes') {
      const strokes = parseInt(value.split(' ')[0], 10);
      if (!isNaN(strokes) && !charData.stroke_count) {
        charData.stroke_count = strokes;
      }
    }
  }

  console.log(`Extracted Unicode metadata for ${charMap.size} characters.`);

  // 3. Update existing characters in database
  console.log('Updating characters table with radical and stroke_count...');
  const updateStmt = db.prepare(`
    UPDATE characters
    SET radical = COALESCE(?, radical),
        stroke_count = COALESCE(?, stroke_count)
    WHERE simplified = ? OR traditional = ?
  `);

  let updatedCount = 0;
  const updateTx = db.transaction(() => {
    for (const [char, meta] of charMap.entries()) {
      if (meta.radical != null || meta.stroke_count != null) {
        const info = updateStmt.run(meta.radical ?? null, meta.stroke_count ?? null, char, char);
        if (info.changes > 0) {
          updatedCount += info.changes;
        }
      }
    }
  });

  updateTx();
  console.log(`Updated radical / stroke count on ${updatedCount} rows in characters.`);
}

// 4. Verification queries
const radCount = db.prepare('SELECT count(*) as cnt FROM radicals').get().cnt;
const withRad = db.prepare('SELECT count(*) as cnt FROM characters WHERE radical IS NOT NULL').get().cnt;
const withStrokes = db.prepare('SELECT count(*) as cnt FROM characters WHERE stroke_count IS NOT NULL').get().cnt;
const totalChars = db.prepare('SELECT count(*) as cnt FROM characters').get().cnt;

console.log('\n--- VERIFICATION STATS ---');
console.log(`Total radicals in table: ${radCount}`);
console.log(`Characters with radical: ${withRad} / ${totalChars}`);
console.log(`Characters with stroke_count: ${withStrokes} / ${totalChars}`);

// Sample lookup: 好 (Hao)
const hao = db.prepare('SELECT simplified, traditional, pinyin, radical, stroke_count, definition FROM characters WHERE simplified = ?').get('好');
console.log('\nSample Character "好":', hao);

if (hao && hao.radical) {
  const radInfo = db.prepare('SELECT * FROM radicals WHERE id = ?').get(hao.radical);
  console.log('Radical Info for "好":', radInfo);
}

db.close();
