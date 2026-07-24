import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanSearchExcerpt, detectSearchLanguage, searchPublicKnowledge } from "../src/lib/web-search/service";

describe("public knowledge search", () => {
  it("detects Chinese queries and removes API markup", () => {
    assert.equal(detectSearchLanguage("微积分 基本定理"), "zh");
    assert.equal(detectSearchLanguage("fundamental theorem of calculus"), "en");
    assert.equal(cleanSearchExcerpt("The <span class=\"searchmatch\">Moon</span> &amp; Earth"), "The Moon & Earth");
  });

  it("uses a fixed Wikipedia host and maps citation links", async () => {
    let requested = "";
    const fakeFetch: typeof fetch = async (input) => {
      requested = String(input);
      return new Response(JSON.stringify({ pages: [{ id: 42, key: "Fundamental_theorem_of_calculus", title: "Fundamental theorem of calculus", description: "Theorem", excerpt: "Links differentiation &amp; integration." }] }), { status: 200 });
    };
    const value = await searchPublicKnowledge("fundamental theorem of calculus", fakeFetch);
    assert.match(requested, /^https:\/\/en\.wikipedia\.org\/w\/rest\.php\/v1\/search\/page/);
    assert.equal(value.results.length, 1);
    assert.equal(value.results[0].source, "Wikipedia");
    assert.match(value.results[0].url, /^https:\/\/en\.wikipedia\.org\/wiki\//);
    assert.equal(value.results[0].excerpt, "Links differentiation & integration.");
  });

  it("rejects unsafe or empty-size input before a request", async () => {
    const failFetch: typeof fetch = async () => { throw new Error("must not run"); };
    await assert.rejects(() => searchPublicKnowledge(" ", failFetch), /2 to 200/);
    await assert.rejects(() => searchPublicKnowledge("x".repeat(201), failFetch), /2 to 200/);
  });
});
