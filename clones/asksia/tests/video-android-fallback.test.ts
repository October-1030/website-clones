import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractMediaSource } from "../src/lib/video/source";

describe("YouTube Android caption fallback", () => {
  it("uses an Android Innertube signed track when WEB timedtext is empty", async () => {
    const videoId = "and1234XYZ0";
    const webTrack = `https://www.youtube.com/api/timedtext?v=${videoId}&web=1`;
    const androidTrack = `https://www.youtube.com/api/timedtext?v=${videoId}&android=1`;
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/watch") {
        const html = `<script>{"INNERTUBE_API_KEY":"fixture-key","captionTracks":[{"baseUrl":"${webTrack.replaceAll("&", "\\u0026")}","languageCode":"ar"}],"lengthSeconds":"100"}</script>`;
        return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      if (url.pathname === "/youtubei/v1/player" && init?.method === "POST") {
        return new Response(JSON.stringify({
          playabilityStatus: { status: "OK" },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                { baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ar`, languageCode: "ar" },
                { baseUrl: androidTrack, languageCode: "en" },
              ],
            },
          },
          videoDetails: { title: "Android Caption Fixture", author: "Fixture Channel", lengthSeconds: "100" },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/api/timedtext" && url.searchParams.get("android") === "1") {
        return new Response(JSON.stringify({
          events: [
            { tStartMs: 0, dDurationMs: 5_000, segs: [{ utf8: "The Android signed caption URL returns a complete public transcript." }] },
            { tStartMs: 5_000, dDurationMs: 5_000, segs: [{ utf8: "This fallback avoids the WEB client proof-of-origin token gate." }] },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/api/timedtext") return new Response("", { status: 200 });
      return new Response("not found", { status: 404 });
    };

    const source = await extractMediaSource(`https://www.youtube.com/watch?v=${videoId}`, {
      fetchImpl: fetchImpl as typeof fetch,
      environment: { ...process.env, STUDYPAL_MEDIA_LANGUAGE: "en" },
    });
    assert.equal(source.title, "Android Caption Fixture");
    assert.equal(source.author, "Fixture Channel");
    assert.equal(source.language, "en");
    assert.equal(source.transcript.length, 2);
    assert.match(source.transcript[1].text, /proof-of-origin token gate/);
  });
});
