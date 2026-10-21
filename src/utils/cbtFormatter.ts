/**
 * Utility for formatting CBT questions, passages, and options in React Native.
 * Converts HTML tags, entities, math formulas, and symbols into clean,
 * human-readable Unicode text without showing raw code.
 */

// Mapping of common superscripts and subscripts
const SUPERSCRIPTS: { [key: string]: string } = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'm': 'ᵐ', 'n': 'ⁿ',
  'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ',
  'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
};

const SUBSCRIPTS: { [key: string]: string } = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
};

const HTML_ENTITIES: { [key: string]: string } = {
  '&plusmn;': '±', '&times;': '×', '&divide;': '÷', '&radic;': '√',
  '&deg;': '°', '&le;': '≤', '&ge;': '≥', '&ne;': '≠',
  '&asymp;': '≈', '&equiv;': '≡', '&infin;': '∞', '&prop;': '∝',
  '&part;': '∂', '&sum;': '∑', '&prod;': '∏', '&int;': '∫',
  '&isin;': '∈', '&notin;': '∉', '&cap;': '∩', '&cup;': '∪',
  '&sub;': '⊂', '&sup;': '⊃', '&sube;': '⊆', '&supe;': '⊇',
  '&perp;': '⊥', '&ang;': '∠',
  '&pi;': 'π', '&alpha;': 'α', '&beta;': 'β', '&gamma;': 'γ',
  '&delta;': 'δ', '&theta;': 'θ', '&lambda;': 'λ', '&mu;': 'μ',
  '&sigma;': 'σ', '&omega;': 'ω', '&phi;': 'φ',
  '&Delta;': 'Δ', '&Omega;': 'Ω', '&Sigma;': 'Σ',
  '&sup1;': '¹', '&sup2;': '²', '&sup3;': '³',
  '&frac12;': '½', '&frac14;': '¼', '&frac34;': '¾',
  '&frac13;': '⅓', '&frac23;': '⅔', '&frac18;': '⅛',
  '&prime;': '′', '&Prime;': '″', '&micro;': 'µ',
  '&middot;': '·', '&bull;': '•', '&hellip;': '…',
  '&larr;': '←', '&rarr;': '→', '&harr;': '↔',
  '&rArr;': '⇒', '&lArr;': '⇐', '&hArr;': '⇔',
  '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'",
  '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
};

export function formatCbtText(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // 1. Convert Quill / Math spans: <span class="ql-formula" data-value="...">...</span>
  text = text.replace(/<span class="ql-formula"[^>]*data-value="([^"]+)"[^>]*>.*?<\/span>/gi, (_, tex) => {
    return tex;
  });

  // 2. Handle <sup> and <sub> tags before stripping HTML
  text = text.replace(/<sup>(.*?)<\/sup>/gi, (_, inner) => {
    return inner.split('').map((ch: string) => SUPERSCRIPTS[ch] || ch).join('');
  });
  text = text.replace(/<sub>(.*?)<\/sub>/gi, (_, inner) => {
    return inner.split('').map((ch: string) => SUBSCRIPTS[ch] || ch).join('');
  });

  // 3. Convert line breaks and paragraph ends
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');

  // 4. Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // 5. Decode numeric entities (&#176;, &#x00B0;)
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    try { return String.fromCharCode(parseInt(dec, 10)); } catch { return _; }
  });
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch { return _; }
  });

  // 6. Decode named HTML entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, char);
  }

  // 7. Format common LaTeX fractions and roots
  text = text.replace(/\\(?:dfrac|frac)\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');
  text = text.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, '$1√($2)');
  text = text.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // 8. Convert LaTeX exponents & subscripts (^2 -> ², _2 -> ₂)
  text = text.replace(/\^\{([0-9a-z+\-]+)\}/gi, (_, exp) => {
    return exp.split('').map((c: string) => SUPERSCRIPTS[c] || c).join('');
  });
  text = text.replace(/\^([0-9])/g, (_, d) => SUPERSCRIPTS[d] || d);
  text = text.replace(/_\{([0-9a-z+\-]+)\}/gi, (_, sub) => {
    return sub.split('').map((c: string) => SUBSCRIPTS[c] || c).join('');
  });
  text = text.replace(/_([0-9])/g, (_, d) => SUBSCRIPTS[d] || d);

  // 9. Convert common LaTeX symbols to Unicode
  text = text.replace(/\\pm\b/g, '±')
    .replace(/\\times\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\leq?\b/g, '≤')
    .replace(/\\geq?\b/g, '≥')
    .replace(/\\neq?\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\equiv\b/g, '≡')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\degree\b/g, '°')
    .replace(/\^\\circ\b/g, '°')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\lambda\b/g, 'λ')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\omega\b/g, 'ω')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\Omega\b/g, 'Ω')
    .replace(/\\Sigma\b/g, 'Σ')
    .replace(/\\rightarrow\b/g, '→')
    .replace(/\\to\b/g, '→')
    .replace(/\\leftarrow\b/g, '←')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\\\{/g, '{')
    .replace(/\\right\\\}/g, '}');

  // 10. Strip display/inline math delimiters ($$...$$, $...$, \(...\), \[...\])
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1');

  // Strip single $ delimiters around formulas
  text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, '$1$2');

  // 11. Normalize excessive whitespace/newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
