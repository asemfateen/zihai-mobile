import type { SQLiteDatabase } from 'expo-sqlite';
import { convertNumberedPinyin, stripToFlatPinyin, normalizeToNumberedPinyin } from '../utils/pinyin';
import { cleanDefinition } from '../utils/text';

export interface SearchResult {
  id: number | string;
  simplified: string;
  traditional?: string | null;
  pinyin: string;
  pinyin_flat?: string;
  definition: string;
  hsk_level?: number;
}

export interface ComponentChar {
  id?: number;
  character: string;
  traditional?: string;
  pinyin?: string;
  english_definition?: string;
  hsk_level?: number;
  radical?: number;
  radical_char?: string;
  stroke_count?: number;
  definitions?: string[];
}

export interface WordDetailData {
  id?: number;
  character: string;
  traditional?: string;
  pinyin: string;
  english_definition?: string;
  hsk_level?: number;
  radical?: number;
  radical_name?: string | null;
  radical_char?: string | null;
  stroke_count?: number;
  definitions?: string[];
  components?: ComponentChar[];
}

interface RankedResult extends SearchResult {
  rank: number;
}

/**
 * Searches the local offline SQLite database with full Pleco-grade resilience:
 * - Simplified Hanzi
 * - Traditional Hanzi
 * - Tone-marked Pinyin (e.g., "nǐhǎo")
 * - Tone-numbered Pinyin (e.g., "ni3hao3")
 * - Flat Pinyin (e.g., "nihao", "ni hao")
 * - English gloss definitions
 */
export async function searchDictionary(
  db: SQLiteDatabase,
  query: string
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Protect against expensive full-table scans for pure wildcard/punctuation queries (e.g. "%%", "---")
  if (!/[\u3400-\u9fff\da-zA-Z]/.test(q)) return [];

  const hasChinese = /[\u3400-\u9fff]/.test(q);

  if (hasChinese) {
    const qChinese = q.replace(/\s+/g, '');
    const exact = qChinese;
    const prefix = `${qChinese}%`;
    const sub = `%${qChinese}%`;

    const charRows = await db.getAllAsync<RankedResult>(
      `SELECT ('c_' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
        CASE
          WHEN simplified = ? OR traditional = ? THEN 100
          WHEN simplified LIKE ? OR traditional LIKE ? THEN 80
          ELSE 50
        END as rank
      FROM characters
      WHERE simplified LIKE ? OR traditional LIKE ?
      ORDER BY rank DESC, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC
      LIMIT 30`,
      [exact, exact, prefix, prefix, sub, sub]
    );

    const wordRows = await db.getAllAsync<RankedResult>(
      `SELECT ('w_' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
        CASE
          WHEN simplified = ? OR traditional = ? THEN 100
          WHEN simplified LIKE ? OR traditional LIKE ? THEN 80
          ELSE 50
        END as rank
      FROM cedict_words
      WHERE simplified LIKE ? OR traditional LIKE ?
      ORDER BY rank DESC, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC
      LIMIT 30`,
      [exact, exact, prefix, prefix, sub, sub]
    );

    const extraRows: RankedResult[] = [];
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      for (const tok of tokens) {
        if (/[\u3400-\u9fff]/.test(tok)) {
          const tokCharRows = await db.getAllAsync<RankedResult>(
            `SELECT ('c_' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
              85 as rank
            FROM characters
            WHERE simplified = ? OR traditional = ?
            LIMIT 5`,
            [tok, tok]
          );
          const tokWordRows = await db.getAllAsync<RankedResult>(
            `SELECT ('w_' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
              85 as rank
            FROM cedict_words
            WHERE simplified = ? OR traditional = ?
            LIMIT 5`,
            [tok, tok]
          );
          extraRows.push(...tokCharRows, ...tokWordRows);
        }
      }
    }

    const map = new Map<string, RankedResult>();
    for (const item of [...charRows, ...wordRows, ...extraRows]) {
      const key = item.simplified;
      const existing = map.get(key);
      if (!existing || existing.rank < item.rank) {
        map.set(key, item);
      }
    }

    const merged = Array.from(map.values())
      .sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        const aHsk = a.hsk_level && a.hsk_level > 0 ? a.hsk_level : 99;
        const bHsk = b.hsk_level && b.hsk_level > 0 ? b.hsk_level : 99;
        if (aHsk !== bHsk) return aHsk - bHsk;
        return a.simplified.length - b.simplified.length;
      })
      .slice(0, 50);

    return merged.map((item) => ({
      ...item,
      pinyin: convertNumberedPinyin(item.pinyin, item.simplified.length),
    }));
  }

  // Not Chinese: Could be Pinyin or English definition
  const stripped = stripToFlatPinyin(q);
  const qLower = q.toLowerCase();
  const numberedQuery = normalizeToNumberedPinyin(q);
  const hasTone = /[1-5]/.test(numberedQuery);

  let pinyinResults: RankedResult[] = [];
  if (stripped.length >= 1) {
    const toneExact = numberedQuery;
    const toneExactU = numberedQuery.replace(/v/g, 'u:');

    // Patterns for whole-reading match in multi-reading strings (e.g. "hao3 hao4")
    const tStart = `${toneExact} %`;
    const tStartU = `${toneExactU} %`;
    const tSpaceMid = `% ${toneExact} %`;
    const tSpaceMidU = `% ${toneExactU} %`;
    const tSpaceEnd = `% ${toneExact}`;
    const tSpaceEndU = `% ${toneExactU}`;

    // Flat whole-syllable patterns for pinyin_flat (e.g. "de di", "zhang chang")
    const flatExact = stripped;
    const flatStart = `${stripped} %`;
    const flatMid = `% ${stripped} %`;
    const flatEnd = `% ${stripped}`;
    const flatPrefix = `${stripped}%`;

    const pinyinSql = (table: 'characters' | 'cedict_words') => `
      SELECT ('${table === 'characters' ? 'c_' : 'w_'}' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
        CASE
          /* 1. Exact Tone Reading (Highest Priority: 160) */
          WHEN (pinyin = ? COLLATE NOCASE OR pinyin = ? COLLATE NOCASE
            OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE
            OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE
            OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE) THEN 160

          /* 2. Exact Flat Whole Syllable / Word (140) */
          WHEN (pinyin_flat = ?
            OR pinyin_flat LIKE ?
            OR pinyin_flat LIKE ?
            OR pinyin_flat LIKE ?) THEN 140

          /* 3. Prefix Tone (120) */
          WHEN (pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE) THEN 120

          /* 4. Prefix Flat (70) */
          WHEN pinyin_flat LIKE ? THEN 70
          ELSE 35
        END as rank
      FROM ${table}
      WHERE (
        /* Exact tone matching */
        pinyin = ? COLLATE NOCASE OR pinyin = ? COLLATE NOCASE
        OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE
        OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE
        OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE
        /* Flat syllable / word matching */
        OR pinyin_flat = ?
        OR pinyin_flat LIKE ?
        OR pinyin_flat LIKE ?
        OR pinyin_flat LIKE ?
        /* Flat prefix matching */
        OR pinyin_flat LIKE ?
      )
      ORDER BY rank DESC, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC
      LIMIT 40
    `;

    const pinyinCaseParams = [
      // 1. Exact tone
      toneExact, toneExactU,
      tStart, tStartU,
      tSpaceMid, tSpaceMidU,
      tSpaceEnd, tSpaceEndU,
      // 2. Exact flat
      flatExact, flatStart, flatMid, flatEnd,
      // 3. Prefix tone
      tStart, tStartU,
      // 4. Prefix flat
      flatPrefix,
    ];

    const pinyinWhereParams = [
      toneExact, toneExactU,
      tStart, tStartU,
      tSpaceMid, tSpaceMidU,
      tSpaceEnd, tSpaceEndU,
      flatExact,
      flatStart,
      flatMid,
      flatEnd,
      flatPrefix,
    ];

    const allPinyinParams = [...pinyinCaseParams, ...pinyinWhereParams];

    const charRows = await db.getAllAsync<RankedResult>(pinyinSql('characters'), allPinyinParams);
    const wordRows = await db.getAllAsync<RankedResult>(pinyinSql('cedict_words'), allPinyinParams);

    pinyinResults = [...charRows, ...wordRows];

    // Multi-syllable spaced pinyin support (e.g. "ni hao", "wo ai ni", "ni hao ma"):
    // Select top 1 high-confidence single character for each constituent syllable (prioritizing HSK > 0)
    // so users get the compound word on top followed by its direct characters, without noisy homophones.
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      for (const tok of tokens) {
        const tokNum = normalizeToNumberedPinyin(tok);
        const tokFlat = stripToFlatPinyin(tok);
        const tokHasTone = /[1-5]/.test(tokNum);

        let charRow: RankedResult | null = null;
        if (tokHasTone) {
          charRow = await db.getFirstAsync<RankedResult>(
            `SELECT ('c_' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
              120 as rank
            FROM characters
            WHERE (pinyin = ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE OR pinyin LIKE ? COLLATE NOCASE)
            ORDER BY (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC
            LIMIT 1`,
            [tokNum, `${tokNum} %`, `% ${tokNum} %`, `% ${tokNum}`]
          );
        }
        if (!charRow && tokFlat) {
          charRow = await db.getFirstAsync<RankedResult>(
            `SELECT ('c_' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
              120 as rank
            FROM characters
            WHERE (pinyin_flat = ? OR pinyin_flat LIKE ? OR pinyin_flat LIKE ? OR pinyin_flat LIKE ?)
              AND (definition NOT LIKE '%variant of%' AND definition NOT LIKE '%archaic%')
            ORDER BY (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC
            LIMIT 1`,
            [tokFlat, `${tokFlat} %`, `% ${tokFlat} %`, `% ${tokFlat}`]
          );
        }
        if (charRow) {
          pinyinResults.push(charRow);
        }
      }
    }
  }

  // English definition search
  const qClean = qLower.replace(/[!?,.;:'"]/g, '').trim();
  let defResults: RankedResult[] = [];

  // If query looks like a valid Pinyin syllable or has tones, downweight definition match to prevent collision
  const isPinyinCandidate = stripped.length >= 1 && /^[a-z\s]+$/.test(qClean);
  const defBaseRank = (hasTone || (isPinyinCandidate && qClean.length <= 4)) ? 50 : 130;

  if (qClean.length >= 2) {
    const pExact = qClean;
    const pStartSemi = `${qClean};%`;
    const pMidSemi = `%; ${qClean};%`;
    const pEnd = `%; ${qClean}`;
    const pStartExcl = `${qClean}!%`;
    const pMidExcl = `%; ${qClean}!%`;
    const pEndExcl = `%; ${qClean}!`;
    const pStartQ = `${qClean}?%`;
    const pMidQ = `%; ${qClean}?%`;
    const pEndQ = `%; ${qClean}?`;
    const pToStart = `to ${qClean};%`;
    const pToMid = `%; to ${qClean};%`;
    const pToEnd = `%; to ${qClean}`;
    const pSub = `%${qClean}%`;

    const defSql = (table: 'characters' | 'cedict_words') => `
      SELECT ('${table === 'characters' ? 'c_' : 'w_'}' || id) as id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
        CASE
          WHEN definition = ? COLLATE NOCASE
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            THEN ${defBaseRank + 20}
          WHEN definition LIKE ?
            OR definition LIKE ?
            OR definition LIKE ?
            THEN ${defBaseRank}
          WHEN definition LIKE ?
            THEN 40
          ELSE 20
        END as rank
      FROM ${table}
      WHERE definition LIKE ?
      ORDER BY rank DESC, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC
      LIMIT 30
    `;

    const defParams = [
      pExact,
      pStartSemi,
      pMidSemi,
      pEnd,
      pStartExcl,
      pMidExcl,
      pEndExcl,
      pStartQ,
      pMidQ,
      pEndQ,
      pToStart,
      pToMid,
      pToEnd,
      pSub,
      pSub,
    ];

    const defChars = await db.getAllAsync<RankedResult>(defSql('characters'), defParams);
    const defWords = await db.getAllAsync<RankedResult>(defSql('cedict_words'), defParams);

    defResults = [...defChars, ...defWords];
  }

  // Deduplicate and rank
  const map = new Map<string, RankedResult>();
  for (const item of [...defResults, ...pinyinResults]) {
    const key = item.simplified;
    const existing = map.get(key);
    if (!existing || existing.rank < item.rank) {
      map.set(key, item);
    }
  }

  const sorted = Array.from(map.values())
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      const aHsk = a.hsk_level && a.hsk_level > 0 ? a.hsk_level : 99;
      const bHsk = b.hsk_level && b.hsk_level > 0 ? b.hsk_level : 99;
      if (aHsk !== bHsk) return aHsk - bHsk;
      return a.simplified.length - b.simplified.length;
    })
    .slice(0, 50);

  return sorted.map((item) => ({
    ...item,
    pinyin: convertNumberedPinyin(item.pinyin, item.simplified.length),
  }));
}

/**
 * Retrieves comprehensive character/word details locally:
 * - Pinyin & tone
 * - Primary definitions
 * - Kangxi Radical character & English name
 * - Stroke count
 * - Component breakdown for multi-character compound words
 */
export async function getWordDetails(
  db: SQLiteDatabase,
  simplifiedOrTraditional: string
): Promise<WordDetailData | null> {
  const target = simplifiedOrTraditional.trim();
  if (!target) return null;

  interface RawWordRow {
    id: number;
    simplified: string;
    traditional?: string | null;
    pinyin: string;
    definition: string;
    hsk_level?: number;
    stroke_count?: number;
    radical?: number;
  }

  let row: RawWordRow | null = null;

  // Single characters check characters table first for radical/stroke count
  if (target.length === 1) {
    row = await db.getFirstAsync<RawWordRow>(
      `SELECT id, simplified, traditional, pinyin, definition, hsk_level, stroke_count, radical
       FROM characters
       WHERE simplified = ? OR traditional = ?
       LIMIT 1`,
      [target, target]
    );
  }

  // Multi-character words check cedict_words
  if (!row) {
    row = await db.getFirstAsync<RawWordRow>(
      `SELECT id, simplified, traditional, pinyin, definition, hsk_level
       FROM cedict_words
       WHERE simplified = ? OR traditional = ?
       LIMIT 1`,
      [target, target]
    );
  }

  // Fallback check
  if (!row) {
    row = await db.getFirstAsync<RawWordRow>(
      `SELECT id, simplified, traditional, pinyin, definition, hsk_level, stroke_count, radical
       FROM characters
       WHERE simplified = ? OR traditional = ?
       LIMIT 1`,
      [target, target]
    );
  }

  if (!row) return null;

  // Fetch Radical information if available
  let radicalChar: string | null = null;
  let radicalName: string | null = null;
  if (row.radical) {
    interface RadicalRow {
      id: number;
      character: string;
      name: string;
    }
    const radRow = await db.getFirstAsync<RadicalRow>(
      `SELECT id, character, name FROM radicals WHERE id = ? LIMIT 1`,
      [row.radical]
    );
    if (radRow) {
      radicalChar = radRow.character;
      radicalName = radRow.name;
    }
  }

  // Component breakdown for multi-character words
  const components: ComponentChar[] = [];
  if (row.simplified && row.simplified.length > 1) {
    interface CompRowWithRad extends RawWordRow {
      radical_char?: string | null;
    }
    for (const char of row.simplified) {
      const compRow = await db.getFirstAsync<CompRowWithRad>(
        `SELECT c.id, c.simplified, c.traditional, c.pinyin, c.definition, c.hsk_level, c.stroke_count, c.radical, r.character as radical_char
         FROM characters c
         LEFT JOIN radicals r ON c.radical = r.id
         WHERE c.simplified = ? OR c.traditional = ?
         LIMIT 1`,
        [char, char]
      );
      if (compRow) {
        components.push({
          id: compRow.id,
          character: compRow.simplified,
          traditional: compRow.traditional || undefined,
          pinyin: convertNumberedPinyin(compRow.pinyin, compRow.simplified.length),
          english_definition: cleanDefinition(compRow.definition) || compRow.definition,
          hsk_level: compRow.hsk_level,
          radical: compRow.radical,
          radical_char: compRow.radical_char || undefined,
          stroke_count: compRow.stroke_count,
        });
      }
    }
  }

  const rawDefs = row.definition.split(/;\s*|\/\s*/).filter(Boolean);
  const cleanedDefs = rawDefs.map(cleanDefinition).filter(Boolean);

  return {
    id: row.id,
    character: row.simplified,
    traditional: row.traditional || undefined,
    pinyin: convertNumberedPinyin(row.pinyin, row.simplified.length),
    english_definition: cleanDefinition(row.definition) || row.definition,
    hsk_level: row.hsk_level,
    radical: row.radical,
    radical_char: radicalChar,
    radical_name: radicalName,
    stroke_count: row.stroke_count,
    definitions: cleanedDefs.length > 0 ? cleanedDefs : [row.definition],
    components: components.length > 0 ? components : undefined,
  };
}
