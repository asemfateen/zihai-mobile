export function convertNumberedPinyin(pinyinStr) {
  if (!pinyinStr) return ''
  const toneMap = {
    a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'], o: ['ō', 'ó', 'ǒ', 'ò'],
    i: ['ī', 'í', 'ǐ', 'ì'], u: ['ū', 'ú', 'ǔ', 'ù'], v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
  }
  return pinyinStr.toLowerCase().split(' ').map(syllable => {
    const match = syllable.match(/([a-züv]+)([1-5])/)
    if (!match) return syllable
    let [_, word, toneNum] = match
    const tone = parseInt(toneNum) - 1
    if (tone === 4) return word
    word = word.replace('v', 'ü')
    if (word.includes('a')) return word.replace('a', toneMap.a[tone])
    if (word.includes('e')) return word.replace('e', toneMap.e[tone])
    if (word.includes('ou')) return word.replace('ou', toneMap.o[tone] + 'u')
    for (let i = word.length - 1; i >= 0; i--) {
      if (toneMap[word[i]]) {
        return word.substring(0, i) + toneMap[word[i]][tone] + word.substring(i + 1)
      }
    }
    return syllable
  }).join(' ')
}
