import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSafeLinkAddress, parseInline, parseSectionText } from "./section-text.ts";

describe("the section text renderer", () => {
  it("accepts only http, https and app paths as link addresses", () => {
    for (const ok of [
      "https://example.org/a",
      "http://example.org",
      "/informacio",
      "/szulo/allatok",
    ]) {
      assert.equal(isSafeLinkAddress(ok), true, ok);
    }
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example",
      "/\\evil",
      "https://a b",
      "ftp://x",
      "",
    ]) {
      assert.equal(isSafeLinkAddress(bad), false, bad);
    }
  });

  it("splits a line into text, bold and links, marking external ones", () => {
    assert.deepEqual(
      parseInline("Előtte **fontos** [oldal](/informacio) és [web](https://example.org) vége"),
      [
        { kind: "text", text: "Előtte " },
        { kind: "bold", text: "fontos" },
        { kind: "text", text: " " },
        { kind: "link", text: "oldal", href: "/informacio", external: false },
        { kind: "text", text: " és " },
        { kind: "link", text: "web", href: "https://example.org", external: true },
        { kind: "text", text: " vége" },
      ],
    );
  });

  it("shows an unsafe link as its text and never as a link", () => {
    const parts = parseInline("[katt](javascript:x)");
    assert.deepEqual(parts, [{ kind: "text", text: "katt" }]);
    assert.ok(parts.every((p) => p.kind !== "link"));
  });

  it("keeps a tag or an event attribute as plain text", () => {
    const parts = parseInline('<img src=x onerror="alert(1)"> **b**');
    assert.equal(parts[0]?.kind, "text");
    assert.equal(parts[0]?.kind === "text" && parts[0].text.startsWith("<img"), true);
  });

  it("builds paragraphs, bullet lists and numbered lists, ending a list at a blank line", () => {
    const blocks = parseSectionText(
      "Első sor\nfolytatás\n\n- egy\n* kettő\n\n1. alfa\n2) béta\nzáró sor\r\n",
    );
    assert.deepEqual(
      blocks.map((b) => b.kind),
      ["paragraph", "bullets", "numbered", "paragraph"],
    );
    const [first, bullets, numbered] = blocks;
    assert.deepEqual(first?.kind === "paragraph" && first.parts, [
      { kind: "text", text: "Első sor folytatás" },
    ]);
    assert.equal(bullets?.kind === "bullets" && bullets.items.length, 2);
    assert.equal(numbered?.kind === "numbered" && numbered.items.length, 2);
  });

  it("starts a new list when the kind changes and handles an empty text", () => {
    const blocks = parseSectionText("- a\n1. b");
    assert.deepEqual(
      blocks.map((b) => b.kind),
      ["bullets", "numbered"],
    );
    assert.deepEqual(parseSectionText(""), []);
    assert.ok(Object.isFrozen(blocks));
  });
});
