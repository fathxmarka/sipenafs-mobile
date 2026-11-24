import katex from 'katex';

/**
 * Utility for formatting CBT questions, passages, and options in React Native.
 * Supports Unicode math/science symbols, Arabic RTL, Mandarin/CJK, KaTeX HTML rendering,
 * and normalized image extraction for questions and multiple-choice options.
 */

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
  '&perp;': '⊥', '&ang;': '∠', '&nabla;': '∇', '&empty;': '∅',
  '&forall;': '∀', '&exist;': '∃', '&and;': '∧', '&or;': '∨', '&not;': '¬',
  '&pi;': 'π', '&alpha;': 'α', '&beta;': 'β', '&gamma;': 'γ',
  '&delta;': 'δ', '&epsilon;': 'ε', '&theta;': 'θ', '&lambda;': 'λ',
  '&mu;': 'μ', '&nu;': 'ν', '&rho;': 'ρ', '&sigma;': 'σ',
  '&tau;': 'τ', '&omega;': 'ω', '&phi;': 'φ', '&psi;': 'ψ',
  '&Delta;': 'Δ', '&Omega;': 'Ω', '&Sigma;': 'Σ', '&Phi;': 'Φ', '&Psi;': 'Ψ',
  '&sup1;': '¹', '&sup2;': '²', '&sup3;': '³',
  '&frac12;': '½', '&frac14;': '¼', '&frac34;': '¾',
  '&frac13;': '⅓', '&frac23;': '⅔', '&frac18;': '⅛',
  '&prime;': '′', '&Prime;': '″', '&micro;': 'µ',
  '&middot;': '·', '&bull;': '•', '&hellip;': '…',
  '&larr;': '←', '&rarr;': '→', '&harr;': '↔', '&uarr;': '↑', '&darr;': '↓',
  '&rArr;': '⇒', '&lArr;': '⇐', '&hArr;': '⇔',
  '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'",
  '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
};

export function decodeNumericEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (orig, dec) => {
      try {
        const cp = parseInt(dec, 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : orig;
      } catch {
        return orig;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (orig, hex) => {
      try {
        const cp = parseInt(hex, 16);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : orig;
      } catch {
        return orig;
      }
    });
}

export function hasArabicScript(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export function hasCjkScript(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/.test(text);
}

export function hasComplexCbtHtmlOrMath(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  if (/<table\b|<svg\b|class=["'][^"']*ql-formula|class=["'][^"']*katex/i.test(raw)) {
    return true;
  }
  if (/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(raw)) {
    return true;
  }
  if (/\\(?:frac|dfrac|tfrac|sqrt|int|sum|prod|lim|matrix|pmatrix|bmatrix|begin|rightleftharpoons|vec|hat|bar|overline|underline)\b/.test(raw)) {
    return true;
  }
  if (/(^|[^\\])\$([^\$\n]+?)\$/.test(raw)) {
    const match = raw.match(/(^|[^\\])\$([^\$\n]+?)\$/);
    if (match && !/^\s*\d+([.,]\d+)?\s*$/.test(match[2])) {
      return true;
    }
  }
  return false;
}

export function resolveCbtMediaUrl(src: string | null | undefined, apiUrl: string): string {
  if (!src || typeof src !== 'string') return '';
  let cleaned = src.trim().replace(/&amp;/g, '&');
  if (!cleaned || cleaned === 'null' || cleaned === 'undefined') return '';
  if (cleaned.startsWith('data:') || cleaned.startsWith('file:') || cleaned.startsWith('blob:')) {
    return cleaned;
  }

  const base = (apiUrl || '').trim().replace(/\/api\/?$/i, '').replace(/\/+$/, '');

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    // Upgrade http:// ke https:// jika apiUrl memakai https:// dan host sama agar tidak diblokir Android cleartext policy
    if (cleaned.startsWith('http://') && base.startsWith('https://')) {
      try {
        const u = new URL(cleaned);
        const b = new URL(base);
        if (u.host === b.host) {
          return `https://${u.host}${u.pathname}${u.search}${u.hash}`;
        }
      } catch {}
    }
    return cleaned;
  }

  if (cleaned.startsWith('/api/public/')) {
    cleaned = cleaned.replace(/^\/api/, '');
  }

  if (!base) return cleaned;
  return `${base}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
}

export function extractCbtImages(raw: string | null | undefined, apiUrl: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  const urls: string[] = [];

  // Jika nilai string langsung berupa URL gambar
  if (/^(https?:\/\/|\/public\/|\/api\/public\/|data:image\/)/i.test(trimmed) && !trimmed.includes('<')) {
    const resolved = resolveCbtMediaUrl(trimmed, apiUrl);
    if (resolved) urls.push(resolved);
    return urls;
  }

  // Ekstrak seluruh tag <img ... src=...>
  const imgTagRegex = /<img\b[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = imgTagRegex.exec(raw)) !== null) {
    const tag = tagMatch[0];
    const srcMatch =
      tag.match(/\bsrc\s*=\s*"([^"]+)"/i) ||
      tag.match(/\bsrc\s*=\s*'([^']+)'/i) ||
      tag.match(/\bsrc\s*=\s*([^\s>]+)/i);
    if (srcMatch && srcMatch[1]) {
      const resolved = resolveCbtMediaUrl(srcMatch[1], apiUrl);
      if (resolved && !urls.includes(resolved)) {
        urls.push(resolved);
      }
    }
  }
  return urls;
}

export function normalizeCbtQuestionType(type?: string | null, options?: any): 'PG' | 'PGK' | 'ESAI' {
  const t = String(type || '').trim().toUpperCase();
  if (
    t === 'PGK' ||
    t === 'PG KOMPLEKS' ||
    t === 'PG_KOMPLEKS' ||
    t === 'KOMPLEKS' ||
    t === 'MULTIPLE_CHOICE_COMPLEX'
  ) {
    return 'PGK';
  }
  if (t === 'ESAI' || t === 'ESSAY' || t === 'URAIAN') {
    return 'ESAI';
  }
  if (t === 'PG' || (options && Object.keys(options).length > 0)) {
    return 'PG';
  }
  return 'PG';
}

export function parseSelectedOptionKeys(ans: any): string[] {
  if (!ans) return [];
  let raw: any = ans;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    raw = raw.answer ?? '';
  }
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? raw.split(',')
    : [String(raw)];
  return Array.from(
    new Set(arr.map((s) => String(s).trim().toUpperCase()).filter(Boolean))
  ).sort();
}

export function isCbtQuestionAnswered(ans: any, qType?: string | null): boolean {
  if (!ans) return false;
  const kind = normalizeCbtQuestionType(qType);
  if (kind === 'ESAI') {
    if (typeof ans === 'object' && !Array.isArray(ans)) {
      return Boolean(String(ans.answer || '').trim()) || Boolean(ans.image_url);
    }
    return Boolean(String(ans).trim());
  }
  if (kind === 'PGK') {
    return parseSelectedOptionKeys(ans).length > 0;
  }
  return parseSelectedOptionKeys(ans).length > 0 || (typeof ans === 'string' && ans.trim().length > 0);
}

export function normalizeQuestionOptions(rawOptions: any): { [key: string]: string } {
  if (!rawOptions) return {};
  let parsed = rawOptions;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  if (Array.isArray(parsed)) {
    const out: { [key: string]: string } = {};
    parsed.forEach((item, idx) => {
      const key = letters[idx] || String(idx + 1);
      if (item !== null && item !== undefined && String(item).trim() !== '') {
        if (typeof item === 'object') {
          const textPart = item.text || item.label || '';
          const imgPart = item.image_url ? `<img src="${item.image_url}" />` : '';
          out[key] = `${textPart}${imgPart}`;
        } else {
          out[key] = String(item);
        }
      }
    });
    return out;
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const out: { [key: string]: string } = {};
    Object.entries(parsed).forEach(([k, val]) => {
      if (val === null || val === undefined) return;
      const strKey = String(k).trim();
      const mappedKey = /^\d+$/.test(strKey) ? (letters[Number(strKey)] || strKey) : strKey;
      if (typeof val === 'object') {
        const objVal = val as any;
        const textPart = objVal.text || objVal.label || '';
        const imgPart = objVal.image_url ? `<img src="${objVal.image_url}" />` : '';
        out[mappedKey] = `${textPart}${imgPart}`;
      } else if (String(val).trim() !== '') {
        out[mappedKey] = String(val);
      }
    });
    return out;
  }
  return {};
}

export function renderCbtHtmlWithKatex(content: string | null | undefined, apiUrl: string): string {
  if (!content || typeof content !== 'string') return '';
  let processed = content;

  // Auto-wrap bare LaTeX expressions
  const hasMathDelimiters =
    processed.includes('$') ||
    processed.includes('\\(') ||
    processed.includes('\\[') ||
    processed.includes('ql-formula') ||
    processed.includes('class="katex"');
  const isProse = /\b(jika|adalah|pada|sebuah|tentukan|hitung|berapakah|maka|panjang|luas|keliling|segitiga|persegi)\b/i.test(processed);

  if (!hasMathDelimiters && !isProse) {
    if (/\\(?:sqrt|frac|dfrac|times|div|pm|cdot|text|alpha|beta|gamma|theta|pi|le|ge|ne|approx|int|sum|rightleftharpoons)\b/.test(processed)) {
      processed = `\\(${processed.trim()}\\)`;
    }
  }

  // 1. Quill formula spans
  processed = processed.replace(/<span[^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*data-value="([^"]+)"[^>]*>.*?<\/span>/gi, (orig, tex) => {
    try {
      const decoded = tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      return katex.renderToString(decoded, { displayMode: false, throwOnError: false });
    } catch {
      return orig;
    }
  });

  // 2. Display math $$...$$ and \[...\]
  processed = processed
    .replace(/\$\$([\s\S]*?)\$\$/g, (orig, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return orig;
      }
    })
    .replace(/\\\[([\s\S]*?)\\\]/g, (orig, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return orig;
      }
    });

  // 3. Inline math \(...\)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (orig, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return orig;
    }
  });

  // 4. Inline math $...$
  processed = processed.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (orig, prefix, tex) => {
    if (/^\s*\d+([.,]\d+)?\s*$/.test(tex)) return orig;
    try {
      return prefix + katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return orig;
    }
  });

  // 5. Unwrapped LaTeX commands (\frac, \sqrt, \int, \sum)
  if (!processed.includes('class="katex"')) {
    processed = processed
      .replace(/(?:[0-9]*\s*)?\\(?:dfrac|frac)\{[^{}]+\}\{[^{}]+\}(?:\s*\\text\{[^{}]+\})?/g, (m) => {
        try { return katex.renderToString(m.trim(), { displayMode: false, throwOnError: false }); } catch { return m; }
      })
      .replace(/(?:[0-9]*\s*)?\\sqrt(?:\[[^\]]*\])?\{[^{}]+\}(?:\s*\\text\{[^{}]+\})?/g, (m) => {
        try { return katex.renderToString(m.trim(), { displayMode: false, throwOnError: false }); } catch { return m; }
      });
  }

  // 6. Rewrite image srcs to full URLs
  processed = processed.replace(/(<img\b[^>]*\bsrc\s*=\s*["']?)([^"'\s>]+)(["']?[^>]*>)/gi, (_, pre, src, post) => {
    const resolved = resolveCbtMediaUrl(src, apiUrl);
    return `${pre}${resolved}${post}`;
  });

  // 7. Decode numeric entities cleanly
  processed = decodeNumericEntities(processed);

  return processed;
}

export function formatCbtText(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // 1. Convert Quill / Math spans: <span class="ql-formula" data-value="...">...</span>
  text = text.replace(/<span[^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*data-value="([^"]+)"[^>]*>.*?<\/span>/gi, (_, tex) => {
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

  // 5. Decode numeric entities with full Unicode codePoint support
  text = decodeNumericEntities(text);

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
    .replace(/\\rightleftharpoons\b/g, '⇌')
    .replace(/\\leftrightarrow\b/g, '↔')
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

  text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, '$1$2');

  // 11. Normalize excessive whitespace/newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
