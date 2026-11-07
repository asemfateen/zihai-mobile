import express from 'express'
import { db } from '../db.js'
import { apiLimiter } from '../middleware/rateLimiter.js'
import { resolveRowsBatch, resolveDefinition, splitDefinition } from '../utils/textUtils.js'
import { convertNumberedPinyin } from '../utils/pinyin.js'
import { optionalAuth } from '../middleware/auth.js'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../middleware/auth.js'
const router = express.Router()

router.get('/wotd', async (req, res) => {
  try {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const diff = now - start
    const oneDay = 1000 * 60 * 60 * 24
    const dayOfYear = Math.floor(diff / oneDay)

    const countRow = await db.get(`
      SELECT count(*)::integer as count FROM cedict_words 
      WHERE hsk_level IN (1, 2, 3) AND length(simplified) >= 1 AND length(simplified) <= 3
    `)
    
    const count = countRow?.count || 100
    const targetOffset = dayOfYear % count

    const word = await db.get(`
      SELECT id, simplified AS character, pinyin, definition AS english_definition, hsk_level
      FROM cedict_words
      WHERE hsk_level IN (1, 2, 3) AND length(simplified) >= 1 AND length(simplified) <= 3
      LIMIT 1 OFFSET $1
    `, [targetOffset])

    if (word) {
      word.pinyin = convertNumberedPinyin(word.pinyin)
      await resolveRowsBatch([word])
      res.json(word)
    } else {
      res.status(404).json({ error: 'No word of the day found' })
    }
  } catch (err) {
    console.error('Failed to get word of the day:', err)
    res.status(500).json({ error: 'Failed to generate word of the day' })
  }
})

async function translateText(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(item => item[0]).join('');
    }
  } catch (err) {
    console.error('Translation failed:', err);
  }
  return null;
}

router.post('/analyze', apiLimiter, async (req, res) => {
  const text = req.body.text || '';
  if (typeof text !== 'string') return res.status(400).json({ error: 'Text must be a string' });
  if (text.length > 2000) return res.status(400).json({ error: 'Text too long (max 2000 characters)' });
  if (!text.trim()) return res.json({ tokens: [], translation: null });

  try {
    const tokens = [];
    const maxLen = 6;
    let i = 0;

    while (i < text.length) {
      let matched = false;
      for (let len = maxLen; len > 0; len--) {
        if (i + len > text.length) continue;
        const substr = text.substring(i, i + len);
        
        if (len > 1 && !/[\u4e00-\u9fa5]/.test(substr)) continue;

        let row = await db.get(`
          SELECT id, simplified, pinyin, definition, hsk_level, 'word' as type
          FROM cedict_words 
          WHERE simplified = $1 OR traditional = $2 
          ORDER BY CASE WHEN hsk_level > 0 THEN 0 ELSE 1 END ASC, hsk_level ASC 
          LIMIT 1
        `, [substr, substr]);

        if (!row && len === 1) {
          row = await db.get(`
            SELECT id, simplified, pinyin, definition, hsk_level, 'char' as type
            FROM characters 
            WHERE simplified = $1 OR traditional = $2 
            ORDER BY CASE WHEN hsk_level > 0 THEN 0 ELSE 1 END ASC, hsk_level ASC 
            LIMIT 1
          `, [substr, substr]);
        }

        if (row) {
          const resolvedDef = await resolveDefinition(row.definition)
          tokens.push({
            text: substr,
            isChinese: true,
            id: row.id,
            type: row.type,
            pinyin: convertNumberedPinyin(row.type === 'char' ? row.pinyin.split(/[ ,/]+/)[0] : row.pinyin) || row.pinyin,
            definition: resolvedDef,
            definitions: splitDefinition(resolvedDef),
            hsk_level: row.hsk_level
          });
          i += len;
          matched = true;
          break;
        }
      }

      if (!matched) {
        const char = text[i];
        const isChinese = /[\u4e00-\u9fa5]/.test(char);
        
        if (!isChinese && tokens.length > 0 && !tokens[tokens.length - 1].isChinese) {
          tokens[tokens.length - 1].text += char;
        } else {
          tokens.push({
            text: char,
            isChinese,
            id: null,
            pinyin: null,
            definition: null,
            definitions: [],
            hsk_level: null
          });
        }
        i++;
      }
    }
    
    const translation = await translateText(text);
    
    // Increment daily quest progress if user is logged in
    let userId = null;
    const authHeader = req.headers.authorization;
    let token = req.cookies?.token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // ignore invalid token
      }
    }
    if (userId) {
      try {
        const { incrementQuestProgress } = await import('./quests.js');
        await incrementQuestProgress(userId, 'analyze', 1);
      } catch (err) {
        console.error('Failed to increment quest progress:', err);
      }
    }

    res.json({ tokens, translation });
  } catch (err) {
    console.error('Analyzer error:', err);
    res.status(500).json({ error: 'Failed to analyze text' });
  }
});

router.get('/search', async (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim()
  if (!q) return res.json([])
  if (q.length > 50) return res.status(400).json({ error: 'Query too long' })

  const hasChinese = /[\u4e00-\u9fa5]/.test(q)
  const isAlpha = /^[A-Za-z\s]+$/.test(q)
  const qLower = q.toLowerCase()
  const qUnspaced = qLower.replace(/\s+/g, "")
  let rows = []

  try {
    if (hasChinese) {
      const pattern = q + '%'
      const ch = await db.all(`
        SELECT id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
          CASE WHEN simplified = $1 THEN 1 ELSE 0 END as exact_match,
          CASE WHEN definition LIKE '%variant of%' THEN 1 ELSE 0 END as is_variant
        FROM characters WHERE simplified LIKE $2
        ORDER BY is_variant, exact_match DESC, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC, length(simplified) ASC LIMIT 50
      `, [q, pattern])
      const cw = await db.all(`
        SELECT id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
          CASE WHEN simplified = $1 THEN 1 ELSE 0 END as exact_match,
          CASE WHEN definition LIKE '%variant of%' THEN 1 ELSE 0 END as is_variant
        FROM cedict_words WHERE simplified LIKE $2
        ORDER BY is_variant, exact_match DESC, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC, length(simplified) ASC LIMIT 50
      `, [q, pattern])
      rows = [...ch, ...cw]
    } else if (isAlpha) {
      const prefix = (qUnspaced || qLower) + '%'
      const wildcard = '%' + qLower + '%'
      const prefixSpace = (qUnspaced || qLower) + ' %'
      const prefixSemi = (qUnspaced || qLower) + ';%'

      const ch = await db.all(`
        SELECT id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
          CASE WHEN definition LIKE '%variant of%' THEN 1 ELSE 0 END as is_variant
        FROM characters WHERE pinyin_flat LIKE $1 OR definition LIKE $2
        ORDER BY is_variant ASC,
          (CASE
            WHEN (instr(' ' || pinyin_flat || ' ', ' ' || $3 || ' ') > 0) THEN 3
            WHEN definition = $4 OR definition LIKE $5 OR definition LIKE $6 THEN 3
            WHEN pinyin_flat LIKE $7 THEN 1
            ELSE 0
          END) DESC,
          (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC,
          hsk_level ASC,
          length(simplified) ASC
        LIMIT 50
      `, [prefix, wildcard, qLower, qLower, prefixSpace, prefixSemi, prefix])
      const cw = await db.all(`
        SELECT id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
          CASE WHEN definition LIKE '%variant of%' THEN 1 ELSE 0 END as is_variant
        FROM cedict_words WHERE pinyin_flat LIKE $1 OR definition LIKE $2
        ORDER BY is_variant ASC,
          (CASE
            WHEN (instr(' ' || pinyin_flat || ' ', ' ' || $3 || ' ') > 0) THEN 3
            WHEN definition = $4 OR definition LIKE $5 OR definition LIKE $6 THEN 3
            WHEN pinyin_flat LIKE $7 THEN 1
            ELSE 0
          END) DESC,
          (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC,
          hsk_level ASC,
          length(simplified) ASC
        LIMIT 50
      `, [prefix, wildcard, qLower, qLower, prefixSpace, prefixSemi, prefix])
      rows = [...ch, ...cw]
    } else {
      const pattern = '%' + q + '%'
      const ch = await db.all(`
        SELECT id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
          0 as exact_match,
          CASE WHEN definition LIKE '%variant of%' THEN 1 ELSE 0 END as is_variant
        FROM characters WHERE definition LIKE $1
        ORDER BY is_variant, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC, length(simplified) ASC LIMIT 50
      `, [pattern])
      const cw = await db.all(`
        SELECT id, simplified, traditional, pinyin, pinyin_flat, definition, hsk_level,
          0 as exact_match,
          CASE WHEN definition LIKE '%variant of%' THEN 1 ELSE 0 END as is_variant
        FROM cedict_words WHERE definition LIKE $1
        ORDER BY is_variant, (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC, length(simplified) ASC LIMIT 50
      `, [pattern])
      rows = [...ch, ...cw]
    }
  } catch (err) {
    console.error('Search query failed:', err.message)
    return res.status(500).json({ error: 'Search query failed' })
  }

  rows.forEach(r => {
    r.pinyin = convertNumberedPinyin(r.pinyin)
  })
  await resolveRowsBatch(rows)
  res.json(rows)
})

router.get('/radicals', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT r.id, r.character, r.name, COALESCE(w.cnt, 0)::integer AS count
      FROM radicals r
      LEFT JOIN (SELECT radical, COUNT(*) AS cnt FROM characters WHERE radical IS NOT NULL GROUP BY radical) w ON w.radical = r.id
      ORDER BY w.cnt DESC NULLS LAST, r.id
    `)
    res.json(rows)
  } catch (err) {
    console.error('Radicals query failed:', err.message)
    return res.status(500).json({ error: 'Failed to fetch radicals' })
  }
})

router.get('/radicals/:radical', async (req, res) => {
  const radical = parseInt(req.params.radical, 10)
  if (isNaN(radical) || radical < 1 || radical > 214) {
    return res.status(400).json({ error: 'Radical must be an integer between 1 and 214' })
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100)
  const offset = (page - 1) * limit
  try {
    const radicalInfo = await db.get('SELECT id, character, name FROM radicals WHERE id = $1', [radical])
    if (!radicalInfo) return res.status(404).json({ error: 'Radical not found' })
    const totalRow = await db.get('SELECT COUNT(*)::integer AS cnt FROM characters WHERE radical = $1', [radical])
    const total = totalRow?.cnt || 0
    const words = await db.all(`
      SELECT id, simplified, traditional, pinyin, pinyin AS pinyin_display, definition, hsk_level, radical, stroke_count
      FROM characters WHERE radical = $1
      ORDER BY (CASE WHEN hsk_level > 0 THEN 1 ELSE 0 END) DESC, hsk_level ASC, LENGTH(simplified)
      LIMIT $2 OFFSET $3
    `, [radical, limit, offset])
    words.forEach(w => {
      w.pinyin = convertNumberedPinyin(w.pinyin)
    })
    await resolveRowsBatch(words)
    res.json({ radical: radicalInfo, words, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Radical detail query failed:', err.message)
    return res.status(500).json({ error: 'Failed to fetch radical details' })
  }
})

router.get('/hsk/:level', optionalAuth, async (req, res) => {
  const level = parseInt(req.params.level, 10)
  if (isNaN(level) || level < 1 || level > 6) {
    return res.status(400).json({ error: 'Invalid HSK level' })
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100)
  const offset = (page - 1) * limit
  try {
    const totalRow = await db.get(`
      SELECT (SELECT COUNT(*)::integer FROM characters WHERE hsk_level = $1) +
             (SELECT COUNT(*)::integer FROM cedict_words WHERE hsk_level = $2) AS cnt
    `, [level, level])
    const total = totalRow ? totalRow.cnt : 0

    const words = await db.all(`
      SELECT id, character, traditional, pinyin, pinyin_display, english_definition, hsk_level, is_word
      FROM (
        SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display, definition AS english_definition, hsk_level, 1 as is_word
        FROM cedict_words WHERE hsk_level = $1
        UNION ALL
        SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display, definition AS english_definition, hsk_level, 0 as is_word
        FROM characters WHERE hsk_level = $2
      ) q
      ORDER BY length(character) ASC, character ASC
      LIMIT $3 OFFSET $4
    `, [level, level, limit, offset])

    let deckWordIds = new Set()
    if (req.user) {
      const deckRows = await db.query(
        'SELECT word_id FROM flashcards WHERE user_id = $1',
        [req.user.userId]
      )
      deckWordIds = new Set(deckRows.rows.map(r => r.word_id))
    }

    words.forEach(w => {
      w.pinyin = convertNumberedPinyin(w.pinyin)
      w.inDeck = deckWordIds.has(w.id)
    })
    await resolveRowsBatch(words)

    res.json({ words, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('HSK list query failed:', err.message)
    return res.status(500).json({ error: 'Failed to fetch HSK vocabulary' })
  }
})

router.get('/word/:query', async (req, res) => {
  const { query } = req.params
  const isNumeric = /^\d+$/.test(query)
  let item

  try {
    if (isNumeric) {
      const id = parseInt(query, 10)
      item = await db.get(`
        SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display, pinyin_flat,
               definition AS english_definition, hsk_level
        FROM cedict_words WHERE id = $1
      `, [id])
      if (!item) {
        item = await db.get(`
          SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display, pinyin_flat,
                 definition AS english_definition, hsk_level, radical, stroke_count
          FROM characters WHERE id = $1
        `, [id])
      }
    } else {
      item = await db.get(`
        SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display, pinyin_flat,
               definition AS english_definition, hsk_level
        FROM cedict_words WHERE simplified = $1
      `, [query])
      if (!item) {
        item = await db.get(`
          SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display, pinyin_flat,
                 definition AS english_definition, hsk_level, radical, stroke_count
          FROM characters WHERE simplified = $1
        `, [query])
      }
    }

    if (!item) return res.status(404).json({ error: 'Word not found' })
    item = await resolveRowsBatch(item)
    item.pinyin = convertNumberedPinyin(item.pinyin)

    // Add Component Breakdown
    const components = []
    if (item.character && item.character.length > 1) {
      for (let i = 0; i < item.character.length; i++) {
        const char = item.character[i]
        let charData = await db.get(`
          SELECT id, simplified AS character, traditional, pinyin, pinyin AS pinyin_display,
                 definition AS english_definition, hsk_level, radical, stroke_count
          FROM characters WHERE simplified = $1
        `, [char])
        if (charData) {
          charData = await resolveRowsBatch(charData)
          charData.pinyin = convertNumberedPinyin(charData.pinyin)
          components.push(charData)
        } else {
          components.push({ character: char, unknown: true })
        }
      }
    }
    item.components = components

    res.json({ ...item, examples: [] })
  } catch (error) {
    console.error('Word fetch error:', error.message)
    res.status(500).json({ error: 'Database error' })
  }
})

export default router
