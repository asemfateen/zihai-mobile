/**
 * Cleans CC-CEDICT definitions by stripping parenthetical notes, bracketed pronunciations/characters,
 * and filtering out reference noise (like "see also", "CL:...").
 * If the entry contains a "surname [Name]" gloss alongside standard definitions, the surname
 * is moved to the end so primary semantic definitions are presented first.
 */
export function cleanDefinition(def: string): string {
  if (!def) return '';

  // Split by semicolon to handle separate definition parts
  const parts = def.split(';');

  const cleanedParts = parts
    .map((part) => {
      let temp = part;
      // Remove bracketed text, e.g., [ling2]
      temp = temp.replace(/\[[^\]]*\]/g, '');
      // Remove parentheses, e.g., (informal...)
      temp = temp.replace(/\([^)]*\)/g, '');
      // Remove curly braces, e.g., {etc}
      temp = temp.replace(/\{[^}]*\)/g, '');

      // Condense multiple spaces and trim
      return temp.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  // Pure metadata noise that should NEVER be displayed as a definition
  const pureNoisePatterns = ['cl:', 'see also'];

  // Relational glosses that should be omitted if semantic definitions exist,
  // but kept if the entry has no other definition (e.g. variant characters)
  const relationalPatterns = [
    'trad. form',
    'simplified form',
    'variant of',
    'erroneously for',
    'erroneous variant',
    'abbr. for',
  ];

  // 1. Filter out pure noise completely
  const withoutPureNoise = cleanedParts.filter((part) => {
    const lower = part.toLowerCase();
    return !pureNoisePatterns.some((pattern) => lower.startsWith(pattern) || lower.includes(pattern));
  });

  // 2. Filter out relational patterns if non-relational definitions exist
  const nonRelational = withoutPureNoise.filter((part) => {
    const lower = part.toLowerCase();
    return !relationalPatterns.some((pattern) => lower.includes(pattern));
  });

  const baseParts = nonRelational.length > 0 ? nonRelational : withoutPureNoise;

  // Deduplicate parts
  const uniqueParts: string[] = [];
  for (const part of baseParts) {
    if (!uniqueParts.includes(part)) {
      uniqueParts.push(part);
    }
  }

  // If there are definitions other than "surname [Name]", move surname to the end
  const nonSurname = uniqueParts.filter((p) => !/^surname\s+[a-z]+/i.test(p));
  const surnames = uniqueParts.filter((p) => /^surname\s+[a-z]+/i.test(p));
  const finalParts = nonSurname.length > 0 ? [...nonSurname, ...surnames] : uniqueParts;

  return finalParts.join('; ');
}
