/**
 * Reads acceptance criteria from issue descriptions written in Markdown, e.g.
 *
 *   ### Acceptance Criteria
 *   - [x] Signatures are verified
 *   - [ ] Replayed events are ignored
 *
 * The section runs until the next heading. Headings may be ATX (`###`) or bold (`**Acceptance Criteria**`).
 */
export interface AcceptanceCriteria {
  present: boolean;
  total: number;
  unchecked: number;
}

const SECTION_HEADING = /^\s*(?:#{1,6}\s*|\*\*\s*)?acceptance criteria\b.*$/im;
const ANY_HEADING = /^\s*(?:#{1,6}\s+\S|\*\*[^*]+\*\*\s*:?\s*$)/;
const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]/;

export function parseAcceptanceCriteria(description: string | null | undefined): AcceptanceCriteria {
  if (!description) return { present: false, total: 0, unchecked: 0 };

  const match = SECTION_HEADING.exec(description);
  if (!match) return { present: false, total: 0, unchecked: 0 };

  const sectionLines = description.slice(match.index + match[0].length).split(/\r?\n/);
  let total = 0;
  let unchecked = 0;
  let hasContent = false;

  for (const line of sectionLines) {
    if (ANY_HEADING.test(line)) break;
    if (line.trim().length > 0) hasContent = true;
    const box = CHECKBOX.exec(line);
    if (box) {
      total += 1;
      if (box[1] === ' ') unchecked += 1;
    }
  }

  // A heading with nothing under it does not count as written criteria
  return { present: hasContent, total, unchecked };
}
