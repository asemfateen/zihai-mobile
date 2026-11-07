import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import RADICALS from "./radicals.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "zihai.db");

console.log(`Connecting to database at ${DB_PATH}...`);
const db = new Database(DB_PATH);

// 1. Create radicals table & populate with all 214 Kangxi radicals
console.log("Creating radicals table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS radicals (
    id INTEGER PRIMARY KEY,
    character TEXT NOT NULL,
    name TEXT
  );
`);

const insertRadical = db.prepare(`
  INSERT OR REPLACE INTO radicals (id, character, name)
  VALUES (@id, @character, @name)
`);

const insertAllRadicals = db.transaction((radicals) => {
  for (const r of radicals) {
    insertRadical.run(r);
  }
});

insertAllRadicals(RADICALS);
console.log(`Inserted ${RADICALS.length} Kangxi radicals into radicals table.`);

// 2. Ensure columns exist on characters table
try {
  db.exec("ALTER TABLE characters ADD COLUMN radical INTEGER;");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE characters ADD COLUMN stroke_count INTEGER;");
} catch {
  // column already exists
}

// 3. Parse Unihan_IRGSources.txt for radical and stroke counts
const unihanPath = path.join(__dirname, "data", "raw", "Unihan", "Unihan_IRGSources.txt");
console.log(`Reading Unihan data from ${unihanPath}...`);

function hexToChar(hex) {
  return String.fromCodePoint(parseInt(hex.replace("U+", ""), 16));
}

async function parseUnihan() {
  const metadata = new Map();

  const fileStream = fs.createReadStream(unihanPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.startsWith("#") || line.trim().length === 0) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;

    const hex = parts[0];
    const field = parts[1];
    const value = parts.slice(2).join("\t").trim();

    const char = hexToChar(hex);
    if (!metadata.has(char)) {
      metadata.set(char, {});
    }

    const item = metadata.get(char);

    if (field === "kRSUnicode") {
      // e.g. "1.4" or "1'.4" -> radical 1
      const dotIdx = value.indexOf(".");
      if (dotIdx !== -1) {
        const radStr = value.substring(0, dotIdx).replace(/['"]/g, "");
        const radNum = parseInt(radStr, 10);
        if (!isNaN(radNum) && radNum >= 1 && radNum <= 214) {
          item.radical = radNum;
        }
      }
    } else if (field === "kTotalStrokes") {
      const strokes = parseInt(value.split(" ")[0], 10);
      if (!isNaN(strokes)) {
        item.stroke_count = strokes;
      }
    }
  }

  return metadata;
}

async function main() {
  const unihanMeta = await parseUnihan();
  console.log(`Loaded Unihan metadata for ${unihanMeta.size} characters.`);

  // 4. Update characters table
  console.log("Updating characters table with radical and stroke counts...");
  const updateStmt = db.prepare(`
    UPDATE characters 
    SET radical = COALESCE(?, radical), 
        stroke_count = COALESCE(?, stroke_count)
    WHERE simplified = ?
  `);

  const characters = db.prepare("SELECT simplified FROM characters").all();
  console.log(`Found ${characters.length} characters in database.`);

  let updatedCount = 0;
  const updateAll = db.transaction((rows) => {
    for (const row of rows) {
      const meta = unihanMeta.get(row.simplified);
      if (meta && (meta.radical != null || meta.stroke_count != null)) {
        updateStmt.run(meta.radical ?? null, meta.stroke_count ?? null, row.simplified);
        updatedCount++;
      }
    }
  });

  updateAll(characters);
  console.log(`Updated ${updatedCount} characters with radical & stroke count.`);

  // Create indexes for fast filtering/sorting
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_characters_radical ON characters(radical);
    CREATE INDEX IF NOT EXISTS idx_characters_stroke_count ON characters(stroke_count);
  `);

  // Verify results
  const stats = db.prepare(`
    SELECT 
      COUNT(*) AS total,
      COUNT(radical) AS with_radical,
      COUNT(stroke_count) AS with_strokes
    FROM characters
  `).get();

  console.log("\n--- Verification Summary ---");
  console.log(`Total characters: ${stats.total}`);
  console.log(`With radical: ${stats.with_radical} (${((stats.with_radical / stats.total) * 100).toFixed(1)}%)`);
  console.log(`With stroke count: ${stats.with_strokes} (${((stats.with_strokes / stats.total) * 100).toFixed(1)}%)`);

  const sample = db.prepare("SELECT simplified, pinyin, radical, stroke_count FROM characters LIMIT 5").all();
  console.log("Sample character records:", JSON.stringify(sample, null, 2));

  db.close();
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
