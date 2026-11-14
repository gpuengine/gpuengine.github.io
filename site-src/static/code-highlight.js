const JAVASCRIPT_KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "do", "else", "export",
  "extends", "false", "finally", "for", "from", "function", "if", "import", "in", "instanceof", "let", "new",
  "null", "of", "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "undefined",
  "var", "void", "while", "yield"
]);
const WGSL_KEYWORDS = new Set([
  "alias", "break", "const", "continue", "discard", "else", "enable", "false", "fn", "for", "if", "let", "loop",
  "override", "return", "struct", "switch", "true", "var", "while", "uniform", "storage", "read", "read_write",
  "function", "private", "workgroup"
]);
const WEBGPU_GLOBALS = new Set(["navigator", "GPUBufferUsage", "GPUTextureUsage", "GPUShaderStage", "GPUMapMode"]);
const WGSL_TYPE_PATTERN = /^(?:bool|f16|f32|i32|u32|vec[234][fiuh]?|mat[234]x[234][fh]?|array|atomic|ptr|sampler|sampler_comparison|texture_\w+)$/;
const TOKEN_PATTERNS = {
  js: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g,
  wgsl: /(\/\/[^\n]*)|(@\w+)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?[fiuh]?\b)|([A-Za-z_]\w*)/g,
  html: /(<!--[\s\S]*?-->)|("(?:[^"\\\n]|\\.)*")|(<\/?[A-Za-z][\w-]*|\/?>)/g
};

highlightCodeBlocks();

function highlightCodeBlocks() {
  for (const block of document.querySelectorAll("pre > code[data-language]")) {
    const language = block.dataset.language;
    if (!TOKEN_PATTERNS[language]) continue;
    block.innerHTML = highlightSource(block.textContent, language);
  }
}

function highlightSource(source, language) {
  const pattern = TOKEN_PATTERNS[language];
  let html = "";
  let cursor = 0;
  pattern.lastIndex = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    html += escapeHtml(source.slice(cursor, match.index));
    html += wrapToken(match, language);
    cursor = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(cursor));
}

function wrapToken(match, language) {
  const [token, comment, second, third, word] = match;
  if (comment) return span("code-comment", token);
  if (language === "html") return span(second ? "code-string" : "code-tag", token);
  if (second) return span(language === "wgsl" ? "code-attribute" : "code-string", token);
  if (third) return span("code-number", token);
  return span(classifyWord(word, language), token);
}

function classifyWord(word, language) {
  if (language === "wgsl") {
    if (WGSL_KEYWORDS.has(word)) return "code-keyword";
    if (WGSL_TYPE_PATTERN.test(word)) return "code-type";
    return "";
  }
  if (JAVASCRIPT_KEYWORDS.has(word)) return "code-keyword";
  if (WEBGPU_GLOBALS.has(word)) return "code-type";
  return "";
}

function span(className, text) {
  return className ? `<span class="${className}">${escapeHtml(text)}</span>` : escapeHtml(text);
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
