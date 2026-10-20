/**
 * Comprehensive Arabic Text Normalization & Flexible Search Engine
 * ----------------------------------------------------------------
 * Handles:
 * 1. Hamza & Alef: أ, إ, آ, ٱ, ء -> ا
 * 2. Yaa & Alef Maqsura: ي, ى, ئ, ی -> ي
 * 3. Taa Marbouta & Haa: ة, ه -> ه
 * 4. Waw with Hamza: ؤ -> و
 * 5. Persian/Urdu Kaf: ک -> ك
 * 6. Diacritics (Tashkeel) & Tatweel (ـ) & Zero-width spaces
 * 7. Compound Names & Spacing:
 *    - "عبد الرحمن" <-> "عبدالرحمن"
 *    - "عبد الله" <-> "عبدالله"
 *    - "ابو بكر" <-> "ابوبكر"
 *    - Missing spaces between words ("احمدسيد" <-> "احمد سيد")
 * 8. Multi-token order-agnostic matching
 */

// Common compound prefixes in Arabic names
const COMPOUND_PREFIXES = ['عبد', 'ابو', 'ام', 'ابن', 'بنت', 'اهل', 'ذو', 'ذي'];

/**
 * Converts Arabic-Indic numerals (٠-٩) and Eastern Arabic numerals (۰-۹) to standard Latin digits (0-9)
 */
export function normalizeNumerals(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

/**
 * Normalizes Arabic string to a uniform representation for search matching
 */
export function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';

  return normalizeNumerals(text)
    // 1. Remove diacritics / Tashkeel & Tatweel (ـ)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // 2. Remove invisible zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // 3. Persian / Urdu variants
    .replace(/\u06CC/g, 'ي') // ی -> ي
    .replace(/\u06A9/g, 'ك') // ک -> ك
    // 4. Alef & Hamzas
    .replace(/[أإآٱء]/g, 'ا')
    // 5. Yaa & Alef Maqsura & Nabrah
    .replace(/[ىئ]/g, 'ي')
    // 6. Taa Marbouta -> Haa
    .replace(/ة/g, 'ه')
    // 7. Waw with Hamza
    .replace(/ؤ/g, 'و')
    // 8. Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes student/user name for database insertion/update
 * Keeps authentic Hamzas while cleaning diacritics, invisible chars, and irregular spacing.
 */
export function normalizeStudentName(text: string | null | undefined): string {
  if (!text) return '';

  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u06CC/g, 'ي')
    .replace(/\u06A9/g, 'ك')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips all whitespace for space-insensitive matching
 */
export function stripSpaces(text: string | null | undefined): string {
  return normalizeArabic(text).replace(/\s+/g, '');
}

/**
 * Checks whether a target text matches a search query with full Arabic tolerance:
 * - Letter variations (أ/إ/ا/آ, ي/ى/ئ, ة/ه, etc.)
 * - Space differences ("عبدالرحمن" matches "عبد الرحمن", "احمدسيد" matches "احمد سيد")
 * - Multi-word tokens matching in any order
 */
export function matchesArabic(
  target: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;
  if (!target || !target.trim()) return false;

  const normTarget = normalizeArabic(target);
  const normQuery = normalizeArabic(query);

  // 1. Direct normalized match
  if (normTarget.includes(normQuery)) return true;

  // 2. Space-stripped match (handles "احمدسيد" vs "احمد سيد", "عبدالرحمن" vs "عبد الرحمن")
  const strippedTarget = normTarget.replace(/\s+/g, '');
  const strippedQuery = normQuery.replace(/\s+/g, '');
  if (strippedTarget.includes(strippedQuery)) return true;

  // 3. Multi-token match (all query words must appear in target, regardless of order)
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allTokensFound = tokens.every((token) => {
      // Direct token match
      if (normTarget.includes(token)) return true;
      // Space-stripped compound match for token
      if (strippedTarget.includes(token)) return true;
      return false;
    });

    if (allTokensFound) return true;
  }

  return false;
}

/**
 * Generates an array of search variants for SQL `ilike` and Supabase query builder.
 * Generates variants with and without spaces for compound names (عبدالرحمن <-> عبد الرحمن),
 * as well as letter variants (ه <-> ة, ي <-> ى, ا <-> أ <-> إ).
 */
export function buildArabicSearchPatterns(query: string | null | undefined): string[] {
  if (!query || !query.trim()) return [];

  const raw = query.trim();
  const normalized = normalizeArabic(raw);
  const patterns = new Set<string>();

  // Add base inputs
  patterns.add(raw);
  if (normalized) patterns.add(normalized);

  // 1. Generate variations for compound prefixes (e.g. عبد الرحمن <-> عبدالرحمن)
  for (const prefix of COMPOUND_PREFIXES) {
    const prefixWithSpace = `${prefix} `;
    const prefixWithoutSpace = prefix;

    if (raw.includes(prefixWithSpace)) {
      patterns.add(raw.replace(new RegExp(prefixWithSpace, 'g'), prefixWithoutSpace));
    }
    if (raw.includes(prefixWithoutSpace) && !raw.includes(prefixWithSpace)) {
      patterns.add(raw.replace(new RegExp(prefixWithoutSpace, 'g'), prefixWithSpace));
    }
    if (normalized.includes(prefixWithSpace)) {
      patterns.add(normalized.replace(new RegExp(prefixWithSpace, 'g'), prefixWithoutSpace));
    }
    if (normalized.includes(prefixWithoutSpace) && !normalized.includes(prefixWithSpace)) {
      patterns.add(normalized.replace(new RegExp(prefixWithoutSpace, 'g'), prefixWithSpace));
    }
  }

  // 2. Letter substitutions on all current patterns
  const currentList = Array.from(patterns);
  for (const p of currentList) {
    // ه <-> ة
    patterns.add(p.replace(/ه/g, 'ة'));
    patterns.add(p.replace(/ة/g, 'ه'));
    // ي <-> ى
    patterns.add(p.replace(/ي/g, 'ى'));
    patterns.add(p.replace(/ى/g, 'ي'));
    // ا <-> أ <-> إ <-> آ
    patterns.add(p.replace(/ا/g, 'أ'));
    patterns.add(p.replace(/ا/g, 'إ'));
    patterns.add(p.replace(/ا/g, 'آ'));
    patterns.add(p.replace(/[أإآ]/g, 'ا'));
    // Combined common substitutions
    patterns.add(p.replace(/ه/g, 'ة').replace(/ي/g, 'ى'));
    patterns.add(p.replace(/ة/g, 'ه').replace(/ى/g, 'ي'));
  }

  // 3. Multi-word wildcard pattern (e.g. "محمد احمد" -> "محمد%احمد")
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    patterns.add(tokens.join('%'));
    // Also with reversed token order for "احمد محمد"
    if (tokens.length === 2) {
      patterns.add(`${tokens[1]}%${tokens[0]}`);
    }
  }

  // 4. Return clean unique non-empty array
  return Array.from(patterns)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Flexible Arabic & Multilingual Exam Answer Matcher
 * ----------------------------------------------------
 * Solves:
 * 1. Taa Marbouta vs Haa (ة <-> ه) e.g. "مدرسة" <-> "مدرسه"
 * 2. Yaa vs Alef Maqsura vs Nabrah (ي <-> ى <-> ئ) e.g. "علي" <-> "على", "مصطفى" <-> "مصطفي"
 * 3. Alef & Hamzas (أ / إ / آ / ٱ / ء <-> ا) e.g. "أحمد" <-> "احمد"
 * 4. Arabic-Indic Numerals (٠-٩) vs English Digits (0-9) e.g. "1973" <-> "١٩٧٣"
 * 5. Diacritics (Tashkeel) & Tatweel (ـ)
 * 6. Slight spacing differences e.g. "عبد الرحمن" <-> "عبدالرحمن"
 * 7. Alternative answers separated by / or ، or , (e.g. "القاهرة / القاهرة الكبرى")
 */
function isLevenshteinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let diffs = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      diffs++;
      if (diffs > 1) return false;
      if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) diffs++;
  return diffs <= 1;
}

function singleAnswerMatches(normGiven: string, rawTarget: string): boolean {
  const normTarget = normalizeArabic(normalizeNumerals(rawTarget.trim()));
  if (!normTarget) return false;

  if (normGiven === normTarget) return true;

  const strippedGiven = normGiven.replace(/\s+/g, '');
  const strippedTarget = normTarget.replace(/\s+/g, '');
  if (strippedGiven === strippedTarget) return true;

  // Typo tolerance: Allow 1-letter typo if word length >= 5 (e.g. النيتروجين / النيترجين)
  if (strippedGiven.length >= 5 && strippedTarget.length >= 5) {
    if (isLevenshteinOne(strippedGiven, strippedTarget)) return true;
  }

  return false;
}

export function isExamAnswerCorrect(
  givenAnswer: string | null | undefined,
  correctAnswer: string | null | undefined,
  questionType?: string,
  options?: any
): boolean {
  if (!givenAnswer || (!correctAnswer && (!options || !Array.isArray(options) || options.length === 0))) return false;

  const rawGiven = normalizeNumerals(String(givenAnswer).trim());
  if (!rawGiven) return false;

  // Multiple choice & True/False: case-insensitive direct match
  if (questionType === 'multiple_choice' || questionType === 'true_false') {
    const rawCorrect = normalizeNumerals(String(correctAnswer || '').trim());
    return rawGiven.toLowerCase() === rawCorrect.toLowerCase();
  }

  // Fill in the blank (أكمل الفراغ): apply Arabic linguistic tolerance + alternatives
  const normGiven = normalizeArabic(rawGiven);

  // 1. Gather all acceptable alternatives
  const targets = new Set<string>();
  if (correctAnswer) {
    const parts = String(correctAnswer).split(/[\/,،|]/);
    parts.forEach(p => {
      const trimmed = p.trim();
      if (trimmed) targets.add(trimmed);
    });
  }

  // 2. Also inspect options if it contains alternative strings (for fill_blank)
  if (Array.isArray(options)) {
    options.forEach(opt => {
      if (typeof opt === 'string' && opt.trim()) {
        const parts = opt.split(/[\/,،|]/);
        parts.forEach(p => {
          const trimmed = p.trim();
          if (trimmed) targets.add(trimmed);
        });
      }
    });
  }

  // 3. Match against any target
  for (const target of targets) {
    if (singleAnswerMatches(normGiven, target)) {
      return true;
    }
  }

  return false;
}

