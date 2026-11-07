const Database = require('../../backend/node_modules/better-sqlite3');
const path = require('path');
const fs = require('fs');

const sourcePath = path.resolve(__dirname, '../../backend/zihai.db');
const destDir = path.resolve(__dirname, '../assets');
const destPath = path.resolve(destDir, 'zihai.db');

console.log('Packaging optimized SQLite dictionary from:', sourcePath);
console.log('Destination:', destPath);

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(destPath)) {
  fs.unlinkSync(destPath);
}

const srcDb = new Database(sourcePath, { readonly: true });
const destDb = new Database(destPath);

destDb.pragma('journal_mode = OFF');
destDb.pragma('synchronous = 0');

console.log('Creating schema in destination...');
destDb.exec(`
  CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simplified TEXT UNIQUE NOT NULL,
    traditional TEXT,
    pinyin TEXT NOT NULL,
    pinyin_flat TEXT NOT NULL,
    definition TEXT NOT NULL,
    stroke_count INTEGER,
    radical INTEGER,
    hsk_level INTEGER DEFAULT 0
  );

  CREATE TABLE cedict_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simplified TEXT UNIQUE NOT NULL,
    traditional TEXT,
    pinyin TEXT NOT NULL,
    pinyin_flat TEXT NOT NULL,
    definition TEXT NOT NULL,
    hsk_level INTEGER DEFAULT 0
  );

  CREATE TABLE radicals (
    id INTEGER PRIMARY KEY,
    character TEXT NOT NULL,
    name TEXT
  );
`);

/**
 * Normalizes multi-reading pinyin for characters:
 * - Deduplicates case-variant identical readings (e.g. "shui3 Shui3" -> "shui3")
 * - Generates clean flat pinyin with v-vowel augmentation for ü/u: syllables
 */
function normalizeCharPinyin(rawPinyin, charId) {
  if (!rawPinyin) return { pinyin: '', pinyin_flat: '' };
  let raw = rawPinyin;
  if (charId === 1918) { // 女
    raw = 'nu:3 ru3';
  }
  const syllables = raw.trim().split(/\s+/);
  const seenPinyin = new Set();
  const uniquePinyin = [];

  for (const s of syllables) {
    const lower = s.toLowerCase();
    if (!seenPinyin.has(lower)) {
      seenPinyin.add(lower);
      uniquePinyin.push(lower);
    }
  }

  const pinyin = uniquePinyin.join(' ');

  // Flat pinyin syllables deduplicated with v-vowel support
  const seenFlat = new Set();
  const uniqueFlat = [];
  for (const s of uniquePinyin) {
    const vForm = s.replace(/u:/g, 'v').replace(/[0-5]/g, '').replace(/[^a-z]/g, '');
    if (vForm && !seenFlat.has(vForm)) {
      seenFlat.add(vForm);
      uniqueFlat.push(vForm);
    }
    const flat = s.replace(/[0-5]/g, '').replace(/[^a-z]/g, '');
    if (flat && !seenFlat.has(flat)) {
      seenFlat.add(flat);
      uniqueFlat.push(flat);
    }
  }

  const pinyin_flat = uniqueFlat.join(' ');
  return { pinyin, pinyin_flat };
}

console.log('Copying and normalizing characters...');
const insertChar = destDb.prepare(`
  INSERT INTO characters (id, simplified, traditional, pinyin, pinyin_flat, definition, stroke_count, radical, hsk_level)
  VALUES (@id, @simplified, @traditional, @pinyin, @pinyin_flat, @definition, @stroke_count, @radical, @hsk_level)
`);
const chars = srcDb.prepare('SELECT * FROM characters').all();
const insertCharTx = destDb.transaction((rows) => {
  for (const r of rows) {
    const norm = normalizeCharPinyin(r.pinyin, r.id);
    insertChar.run({
      ...r,
      pinyin: norm.pinyin || r.pinyin,
      pinyin_flat: norm.pinyin_flat || r.pinyin_flat,
    });
  }
});
insertCharTx(chars);
console.log(`Copied and normalized ${chars.length} characters.`);

console.log('Copying cedict_words...');
const insertWord = destDb.prepare(`
  INSERT INTO cedict_words (id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level)
  VALUES (@id, @simplified, @traditional, @pinyin, @pinyin_flat, @definition, @hsk_level)
`);
const words = srcDb.prepare('SELECT * FROM cedict_words').all();
const insertWordTx = destDb.transaction((rows) => {
  for (const r of rows) {
    insertWord.run({
      ...r,
      pinyin_flat: (r.pinyin_flat || '').replace(/u:/g, 'v'),
    });
  }
});
insertWordTx(words);
console.log(`Copied ${words.length} words.`);

console.log('Copying radicals...');
const insertRad = destDb.prepare(`
  INSERT INTO radicals (id, character, name)
  VALUES (@id, @character, @name)
`);
const rads = srcDb.prepare('SELECT * FROM radicals').all();
const insertRadTx = destDb.transaction((rows) => {
  for (const r of rows) insertRad.run(r);
});
insertRadTx(rads);
console.log(`Copied ${rads.length} radicals.`);

console.log('Building search indices...');
destDb.exec(`
  CREATE INDEX idx_characters_simplified ON characters(simplified);
  CREATE INDEX idx_characters_traditional ON characters(traditional);
  CREATE INDEX idx_characters_pinyin_flat ON characters(pinyin_flat);
  CREATE INDEX idx_characters_radical ON characters(radical);
  CREATE INDEX idx_characters_stroke_count ON characters(stroke_count);

  CREATE INDEX idx_cedict_words_simplified ON cedict_words(simplified);
  CREATE INDEX idx_cedict_words_traditional ON cedict_words(traditional);
  CREATE INDEX idx_cedict_words_pinyin_flat ON cedict_words(pinyin_flat);

  CREATE INDEX idx_radicals_id ON radicals(id);
`);

console.log('Vacuuming and optimizing...');
destDb.exec('VACUUM');
destDb.close();
srcDb.close();

const stats = fs.statSync(destPath);
console.log(`Successfully built bundled database: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
