import express from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { EdgeTTS } from 'node-edge-tts'
import { db } from '../db.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TTS_CACHE_DIR = path.join(__dirname, '..', 'tts_cache')
if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true })
}

router.get('/tts', async (req, res) => {
  let text = (req.query.text || '').trim()
  let toneParam = parseInt(req.query.tone, 10)
  if (isNaN(toneParam)) toneParam = null

  if (!text) return res.status(400).json({ error: 'Text is required' })
  if (text.length > 200) return res.status(400).json({ error: 'Text too long' })

  // If text is pinyin, find a representative character
  if (/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüăĕĭŏŭ1-5\s]+$/i.test(text)) {
    const toneMarks = {
      'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
      'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
      'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
      'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
      'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
      'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
      'ă': 3, 'ĕ': 3, 'ĭ': 3, 'ŏ': 3, 'ŭ': 3,
    }
    const vowelMap = {
      'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ă': 'a',
      'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'ĕ': 'e',
      'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'ĭ': 'i',
      'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o', 'ŏ': 'o',
      'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ŭ': 'u',
      'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
    }

    let tone = toneParam
    let clean = text.toLowerCase()

    if (tone === null) {
      for (const [mark, t] of Object.entries(toneMarks)) {
        if (clean.includes(mark)) {
          tone = t
          break
        }
      }
      const matchNum = clean.match(/(\d)$/)
      if (matchNum) {
        tone = parseInt(matchNum[1], 10)
        clean = clean.replace(/\d$/, '')
      }
    } else {
      clean = clean.replace(/\d$/, '')
    }

    for (const [mark, replacement] of Object.entries(vowelMap)) {
      clean = clean.replaceAll(mark, replacement)
    }

    if (tone !== null) {
      const numbered = clean + tone

      try {
        const charRow = await db.get(`
          SELECT simplified FROM characters
          WHERE (' ' || lower(replace(pinyin, 'u:', 'v')) || ' ') LIKE $1
          ORDER BY
            (CASE WHEN lower(replace(pinyin, 'u:', 'v')) = $2 OR lower(replace(pinyin, 'u:', 'v')) = ($3 || ' ' || $4) THEN 0 ELSE 1 END) ASC,
            (CASE WHEN hsk_level > 0 THEN 0 ELSE 1 END) ASC,
            hsk_level ASC,
            length(pinyin) ASC
          LIMIT 1
        `, [`% ${numbered.toLowerCase()} %`, numbered.toLowerCase(), numbered.toLowerCase(), numbered.toLowerCase()])

        if (charRow) {
          text = charRow.simplified
        }
      } catch (dbErr) {
        console.error('TTS database mapping error:', dbErr.message)
      }
    }
  }

  const textHash = crypto.createHash('md5').update(text).digest('hex')
  const cacheFile = path.join(TTS_CACHE_DIR, `${textHash}.mp3`)

  if (fs.existsSync(cacheFile)) {
    res.set('Content-Type', 'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=31536000')
    const stream = fs.createReadStream(cacheFile)
    return stream.pipe(res)
  }

  const tts = new EdgeTTS({
    voice: 'zh-CN-XiaoxiaoNeural',
    lang: 'zh-CN',
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    rate: '-10%'
  })

  const tmpFile = path.join(TTS_CACHE_DIR, `zihai-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)

  try {
    await tts.ttsPromise(text, tmpFile)
    fs.renameSync(tmpFile, cacheFile)

    res.set('Content-Type', 'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=31536000')
    const stream = fs.createReadStream(cacheFile)
    stream.pipe(res)
  } catch (edgeErr) {
    console.error('Edge TTS Error, falling back to Google:', edgeErr.message)
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }

    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-CN&total=1&idx=0&textlen=${text.length}&client=tw-ob&prev=input`
      const response = await fetch(url, {
        headers: {
          'Referer': 'http://translate.google.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      })
      if (!response.ok) throw new Error(`Google TTS status: ${response.status}`)
      const buffer = await response.arrayBuffer()

      fs.writeFileSync(tmpFile, Buffer.from(buffer))
      fs.renameSync(tmpFile, cacheFile)

      res.set('Content-Type', 'audio/mpeg')
      res.set('Cache-Control', 'public, max-age=31536000')
      const stream = fs.createReadStream(cacheFile)
      stream.pipe(res)
    } catch (googleErr) {
      console.error('All TTS services failed:', googleErr.message)
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile)
      }
      res.status(502).json({ error: 'All TTS services failed' })
    }
  }
})

export default router
