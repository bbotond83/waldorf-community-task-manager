/**
 * The simple formatting of an information section (NFR3.12, BR87.3): paragraphs, bulleted and numbered items, bold text
 * and links. The stored text is the author's text and never HTML: this turns it into plain blocks the screen draws as
 * elements, so a tag or an event attribute in the text is shown as text and never run. A link is a link only when its
 * address is an http or https address or a path of this app (NFR3.13), the same rule the database applies on saving;
 * any other `[text](address)` is shown as the text it was written as.
 */
export type InlinePart =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "bold"; text: string }>
  | Readonly<{ kind: "link"; text: string; href: string; external: boolean }>;

export type TextBlock =
  | Readonly<{ kind: "paragraph"; parts: readonly InlinePart[] }>
  | Readonly<{ kind: "bullets"; items: readonly (readonly InlinePart[])[] }>
  | Readonly<{ kind: "numbered"; items: readonly (readonly InlinePart[])[] }>;

const EXTERNAL = /^https?:\/\/\S+$/;
const INTERNAL = /^\/[^/\\\s]\S*$/;

/** Whether an address may become a link: the rule of the database's `info_text_valid`. */
export function isSafeLinkAddress(address: string): boolean {
  return EXTERNAL.test(address) || INTERNAL.test(address);
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]*)\]\(([^)]*)\)/g;

/** Splits one line into text, bold and link parts. */
export function parseInline(line: string): readonly InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ kind: "text", text: line.slice(last, at) });
    if (match[1] !== undefined) {
      parts.push({ kind: "bold", text: match[1] });
    } else if (isSafeLinkAddress(match[3] ?? "")) {
      const href = match[3] ?? "";
      parts.push({ kind: "link", text: match[2] ?? "", href, external: EXTERNAL.test(href) });
    } else {
      parts.push({ kind: "text", text: match[2] ?? "" });
    }
    last = at + match[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last) });
  return parts;
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

/** Turns the stored text into blocks. Blank lines end a paragraph; consecutive list lines form one list. */
export function parseSectionText(body: string): readonly TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  let list: { kind: "bullets" | "numbered"; items: (readonly InlinePart[])[] } | undefined;
  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push({ kind: "paragraph", parts: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: list.kind, items: list.items });
    list = undefined;
  };
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = BULLET.exec(line);
    const number = bullet ? null : NUMBER.exec(line);
    const item = bullet ?? number;
    if (item) {
      flushParagraph();
      const kind = bullet ? "bullets" : "numbered";
      if (list && list.kind !== kind) flushList();
      list ??= { kind, items: [] };
      list.items.push(parseInline(item[1] ?? ""));
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return Object.freeze(blocks);
}
