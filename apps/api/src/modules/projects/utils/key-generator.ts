/**
 * Generates an auto-suggested uppercase project key from a project name.
 * Examples:
 * - "Mobile App" -> "MA" or "MOB"
 * - "Payment Gateway Integration" -> "PGI"
 * - "Core API" -> "CAPI"
 */
export function generateProjectKey(name: string): string {
  if (!name || !name.trim()) {
    return 'PRJ';
  }

  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 3) {
    // Take first letter of first 3-4 words
    return words
      .slice(0, 4)
      .map((w) => w[0].toUpperCase())
      .join('');
  } else if (words.length === 2) {
    // Take first 2 letters of first word + first 2 of second word, or 3 letters
    const part1 = words[0].substring(0, 2).toUpperCase();
    const part2 = words[1].substring(0, 2).toUpperCase();
    return `${part1}${part2}`.substring(0, 4);
  } else {
    // Single word: take first 3-4 letters
    const single = words[0].toUpperCase();
    return single.length >= 3 ? single.substring(0, 4) : `${single}PRJ`.substring(0, 4);
  }
}
