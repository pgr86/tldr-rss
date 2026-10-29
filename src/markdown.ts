// Minimal, safe Markdown renderer for the Jina Reader fallback in src/reader.ts.
// The source is third-party content: everything is HTML-escaped first, and links
// and images only accept http(s) URLs.

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// A URL in (...) may contain one level of balanced parentheses (Wikipedia links)
const URL_PART = "((?:[^()\\s]|\\([^()\\s]*\\))*)";
const LINKED_IMAGE = new RegExp(
  `\\[!\\[([^\\]]*)\\]\\(${URL_PART}\\)\\]\\(${URL_PART}\\)`,
  "g",
);
const IMAGE = new RegExp(`!\\[([^\\]]*)\\]\\(${URL_PART}\\)`, "g");
const LINK = new RegExp(`\\[([^\\]]+)\\]\\(${URL_PART}\\)`, "g");

const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url);

// Jina labels images "Image 3: description" or just "Image 3"
const cleanAlt = (alt: string): string =>
  alt.replace(/^Image\s*\d+\s*:?\s*/i, "").trim();

const imageTag = (src: string, alt: string): string =>
  `<img src="${src}" alt="${cleanAlt(alt)}" loading="lazy">`;

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"';

/** Renders inline Markdown of one block; the text must not be escaped yet */
const renderInline = (text: string): string => {
  // Generated tags are parked in private-use placeholders so emphasis rules can't touch their URLs
  const parked: string[] = [];
  const park = (html: string): string => {
    parked.push(html);
    return `\uE000${parked.length - 1}\uE001`;
  };

  return escapeHtml(text)
    .replace(/`([^`]+)`/g, (_, code: string) => park(`<code>${code}</code>`))
    .replace(LINKED_IMAGE, (_, alt: string, src: string, href: string) => {
      if (!isHttpUrl(src)) return cleanAlt(alt);
      const image = park(imageTag(src, alt));
      return isHttpUrl(href)
        ? park(`<a href="${href}" ${LINK_ATTRS}>`) + image + park("</a>")
        : image;
    })
    .replace(IMAGE, (_, alt: string, src: string) =>
      isHttpUrl(src) ? park(imageTag(src, alt)) : "",
    )
    .replace(LINK, (_, label: string, href: string) =>
      isHttpUrl(href)
        ? park(`<a href="${href}" ${LINK_ATTRS}>`) + label + park("</a>")
        : label,
    )
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(\S(?:.*?\S)?)__/g, "<strong>$1</strong>")
    .replace(/\*(\S(?:.*?\S)?)\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_(\S(?:.*?\S)?)_(?![\w])/g, "$1<em>$2</em>")
    .replace(/\uE000(\d+)\uE001/g, (_, index: string) => parked[Number(index)]);
};

const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const STANDALONE_IMAGE = new RegExp(
  `^(?:${LINKED_IMAGE.source}|${IMAGE.source})$`,
);

const renderList = (lines: string[], marker: RegExp, tag: string): string => {
  const items: string[] = [];
  lines.forEach((line) => {
    const match = line.match(marker);
    if (match) {
      items.push(match[1]);
    } else if (items.length > 0) {
      // Continuation line of the previous item
      items[items.length - 1] += ` ${line.trim()}`;
    }
  });
  return `<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`;
};

const renderFigure = (markdown: string): string => {
  const alt = cleanAlt(markdown.replace(/^\[?!\[([^\]]*)\][\s\S]*$/, "$1"));
  const image = renderInline(markdown);
  if (!image) return "";
  const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : "";
  return `<figure>${image}${caption}</figure>`;
};

/** Renders one block of lines (no blank lines inside) */
const renderBlock = (lines: string[]): string[] => {
  const output: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    output.push(...renderParagraph(paragraph));
    paragraph = [];
  };

  lines.forEach((line) => {
    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
    } else if (RULE.test(line.trim())) {
      flushParagraph();
      output.push("<hr>");
    } else {
      paragraph.push(line);
    }
  });
  flushParagraph();
  return output;
};

const renderParagraph = (lines: string[]): string[] => {
  const trimmed = lines.map((line) => line.trim());
  const text = trimmed.join(" ");

  if (trimmed.every((line) => line.startsWith(">"))) {
    const quote = trimmed.map((line) => line.replace(/^>\s?/, "")).join(" ");
    return [`<blockquote>${renderInline(quote)}</blockquote>`];
  }
  if (BULLET.test(lines[0])) return [renderList(lines, BULLET, "ul")];
  if (NUMBERED.test(lines[0])) return [renderList(lines, NUMBERED, "ol")];
  if (STANDALONE_IMAGE.test(text)) {
    const figure = renderFigure(text);
    return figure ? [figure] : [];
  }
  return [`<p>${renderInline(text)}</p>`];
};

/** Converts Markdown into block-level HTML */
export const markdownToHtml = (markdown: string): string => {
  const blocks: string[] = [];
  let current: string[] = [];
  let code: string[] | null = null;

  const flush = (): void => {
    if (current.length > 0) blocks.push(...renderBlock(current));
    current = [];
  };

  for (const line of markdown.split("\n")) {
    const fence = line.trim().startsWith("```");
    if (code) {
      if (fence) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
    } else if (fence) {
      flush();
      code = [];
    } else if (line.trim() === "") {
      flush();
    } else {
      current.push(line);
    }
  }

  // An unterminated code fence still shows its content
  if (code) {
    blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  }
  flush();

  return blocks.join("\n");
};
