const TONE_DIACRITICS_MAP: Record<string, string> = {
  'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
  'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
  'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
  'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
  'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
  'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v',
};

const DIACRITIC_TO_TONE: Record<string, [string, string]> = {
  'ā': ['a', '1'], 'á': ['a', '2'], 'ǎ': ['a', '3'], 'à': ['a', '4'],
  'ē': ['e', '1'], 'é': ['e', '2'], 'ě': ['e', '3'], 'è': ['e', '4'],
  'ī': ['i', '1'], 'í': ['i', '2'], 'ǐ': ['i', '3'], 'ì': ['i', '4'],
  'ō': ['o', '1'], 'ó': ['o', '2'], 'ǒ': ['o', '3'], 'ò': ['o', '4'],
  'ū': ['u', '1'], 'ú': ['u', '2'], 'ǔ': ['u', '3'], 'ù': ['u', '4'],
  'ǖ': ['v', '1'], 'ǘ': ['v', '2'], 'ǚ': ['v', '3'], 'ǜ': ['v', '4'],
  'ü': ['v', ''],
};

const NUM_TONE_MAP: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/**
 * Normalizes tone-marked pinyin or numbered pinyin to standard spaced numbered pinyin format.
 * e.g. "shuǐ" -> "shui3", "nǐhǎo" -> "ni3 hao3", "ni3hao3" -> "ni3 hao3", "shui" -> "shui"
 */
export function normalizeToNumberedPinyin(input: string): string {
  let s = input.toLowerCase().trim();
  // Normalize CC-CEDICT u: or user-typed ü to standard v
  s = s.replace(/u:/g, 'v').replace(/ü/g, 'v');
  s = s.replace(/([1-5])(?=[a-z])/gi, '$1 ');

  if (s.includes(' ')) {
    return s
      .split(/\s+/)
      .map((tok) => {
        let tone = '';
        let plainTok = tok;
        for (const [dia, [plain, t]] of Object.entries(DIACRITIC_TO_TONE)) {
          if (plainTok.includes(dia)) {
            plainTok = plainTok.replaceAll(dia, plain);
            if (t) tone = t;
          }
        }
        return tone && !/[1-5]$/.test(plainTok) ? `${plainTok}${tone}` : plainTok;
      })
      .join(' ');
  }

  let marked = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (DIACRITIC_TO_TONE[ch] && DIACRITIC_TO_TONE[ch][1]) {
      const [plain, tone] = DIACRITIC_TO_TONE[ch];
      marked += plain + `_TONE${tone}_`;
    } else if (DIACRITIC_TO_TONE[ch]) {
      marked += DIACRITIC_TO_TONE[ch][0];
    } else {
      marked += ch;
    }
  }

  if (!marked.includes('_TONE')) {
    return s;
  }

  const regex = /_TONE(\d)_([a-züv]*)/g;
  const normalized = marked.replace(regex, (_match, tone, rest) => {
    const matchSylEnd = rest.match(/^([ouiea]?n?g?r?)(.*)/);
    if (matchSylEnd) {
      const sylEnd = matchSylEnd[1];
      const nextOnset = matchSylEnd[2];
      return sylEnd + tone + (nextOnset ? ' ' + nextOnset : '');
    }
    return rest + tone;
  });

  return normalized.replace(/([1-5])(?=[a-z])/gi, '$1 ').trim();
}

/**
 * Strips tone diacritics, numbers, spaces, and punctuation to produce a flat search string.
 * e.g., "nǐhǎo" -> "nihao", "ni3 hao3" -> "nihao", "lǚyóu" -> "lvyou", "lu:3 you2" -> "lvyou"
 */
export function stripToFlatPinyin(str: string): string {
  let s = str.toLowerCase();
  s = s.replace(/u:/g, 'v').replace(/ü/g, 'v');
  for (const [diacritic, plain] of Object.entries(TONE_DIACRITICS_MAP)) {
    s = s.replaceAll(diacritic, plain);
  }
  return s.replace(/[0-5]/g, '').replace(/[^a-z]/g, '');
}

function formatSingleSyllable(syllable: string): string {
  if (!syllable) return '';
  // Normalize CC-CEDICT u: or v to ü
  const normalized = syllable.replace(/u:/gi, 'ü').replace(/v/gi, 'ü');
  const match = normalized.match(/([a-zü]+)([1-5])/i);
  if (!match) return normalized;
  const word = match[1].toLowerCase();
  const toneNum = match[2];
  const tone = parseInt(toneNum, 10) - 1;
  if (tone === 4) return word; // 5th tone (neutral)

  let cleanWord = word;
  if (cleanWord.includes('a')) return cleanWord.replace('a', NUM_TONE_MAP.a[tone]);
  if (cleanWord.includes('e')) return cleanWord.replace('e', NUM_TONE_MAP.e[tone]);
  if (cleanWord.includes('ou')) return cleanWord.replace('ou', NUM_TONE_MAP.o[tone] + 'u');

  for (let i = cleanWord.length - 1; i >= 0; i--) {
    const char = cleanWord[i];
    if (NUM_TONE_MAP[char]) {
      return cleanWord.substring(0, i) + NUM_TONE_MAP[char][tone] + cleanWord.substring(i + 1);
    }
  }
  return cleanWord;
}

/**
 * Converts CC-CEDICT style numbered pinyin ("ni3 hao3", "lu:3 you2") into display pinyin with tone marks ("nǐ hǎo", "lǚ yóu").
 * If charCount is 1, duplicate case variants (e.g. "shui3 Shui3") are collapsed and distinct readings
 * are separated cleanly by commas ("hǎo, hào").
 */
export function convertNumberedPinyin(pinyinStr: string, charCount?: number): string {
  if (!pinyinStr) return '';
  const rawSyllables = pinyinStr.trim().split(/\s+/);

  if (charCount === 1) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const syl of rawSyllables) {
      const lower = syl.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(syl);
      }
    }
    return unique.map(formatSingleSyllable).join(', ');
  }

  return rawSyllables.map(formatSingleSyllable).join(' ');
}
