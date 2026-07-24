import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoStudyProvider } from "../src/lib/study/provider";
import { createVideoSession, askVideoSession } from "../src/lib/video/service";
import {
  extractMediaSource,
  extractYoutubeVideoId,
  MediaSourceError,
  mediaSourceToStudyPages,
  validateMediaUrl,
} from "../src/lib/video/source";

const videoId = "abc1234XYZ0";
const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
const youtubeHtml = `
  <html><head>
    <meta property="og:title" content="Neural Networks 101">
    <meta name="author" content="Study Channel">
  </head><body><script>
    {"captionTracks":[{"baseUrl":"${captionUrl.replaceAll("&", "\\u0026")}","languageCode":"en","name":{"simpleText":"English"}}],"lengthSeconds":"125"}
  </script></body></html>
`;
const captionJson = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 4_000, segs: [{ utf8: "A neural network learns patterns from examples by adjusting numerical weights." }] },
    { tStartMs: 4_000, dDurationMs: 5_000, segs: [{ utf8: "Each layer combines inputs, weights, and biases before applying an activation function." }] },
    { tStartMs: 9_000, dDurationMs: 5_000, segs: [{ utf8: "Training compares predictions with targets and propagates error backward." }] },
  ],
});

function youtubeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.pathname === "/watch") return Promise.resolve(new Response(youtubeHtml, { status: 200, headers: { "Content-Type": "text/html" } }));
  if (url.pathname === "/api/timedtext") return Promise.resolve(new Response(captionJson, { status: 200, headers: { "Content-Type": "application/json" } }));
  return Promise.resolve(new Response("not found", { status: 404 }));
}

describe("video URL safety and source extraction", () => {
  it("recognizes supported YouTube URL shapes", () => {
    assert.equal(extractYoutubeVideoId(new URL(`https://youtu.be/${videoId}`)), videoId);
    assert.equal(extractYoutubeVideoId(new URL(`https://www.youtube.com/watch?v=${videoId}`)), videoId);
    assert.equal(extractYoutubeVideoId(new URL(`https://www.youtube.com/shorts/${videoId}`)), videoId);
  });

  it("blocks unsafe protocols, private hosts, and hosts outside the allowlist", () => {
    assert.throws(() => validateMediaUrl("http://www.youtube.com/watch?v=abc1234XYZ0"), MediaSourceError);
    assert.throws(() => validateMediaUrl("https://127.0.0.1/watch?v=abc1234XYZ0"), MediaSourceError);
    assert.throws(() => validateMediaUrl("https://example.com/episode"), /白名单/);
  });

  it("extracts public YouTube captions and builds timestamped study pages", async () => {
    const source = await extractMediaSource(`https://www.youtube.com/watch?v=${videoId}`, { fetchImpl: youtubeFetch as typeof fetch });
    assert.equal(source.kind, "youtube");
    assert.equal(source.title, "Neural Networks 101");
    assert.equal(source.author, "Study Channel");
    assert.equal(source.durationSeconds, 125);
    assert.equal(source.language, "en");
    assert.equal(source.transcript.length, 3);
    const pages = mediaSourceToStudyPages(source);
    assert.equal(pages.length, 1);
    assert.match(pages[0].label, /^0:00–0:14$/);
    assert.match(pages[0].text, /activation function/);
  });

  it("extracts a structured podcast transcript without treating descriptions as transcripts", async () => {
    const transcript = "The episode explains spaced repetition as a method for scheduling review. It compares active recall with passive rereading. The speaker then gives a practical study schedule for the week.";
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "PodcastEpisode",
      name: "How to remember what you study",
      author: { name: "Learning Lab" },
      duration: "PT18M5S",
      transcript,
    })}</script>`;
    const source = await extractMediaSource("https://example.com/episode", {
      environment: { ...process.env, STUDYPAL_MEDIA_ALLOWED_HOSTS: "example.com" },
      fetchImpl: (() => Promise.resolve(new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }))) as typeof fetch,
    });
    assert.equal(source.kind, "podcast");
    assert.equal(source.title, "How to remember what you study");
    assert.equal(source.durationSeconds, 1_085);
    assert.match(source.transcript[0].text, /spaced repetition/);

    await assert.rejects(
      extractMediaSource("https://example.com/no-transcript", {
        environment: { ...process.env, STUDYPAL_MEDIA_ALLOWED_HOSTS: "example.com" },
        fetchImpl: (() => Promise.resolve(new Response('<meta property="og:description" content="Only a short description">', { status: 200 }))) as typeof fetch,
      }),
      (error: unknown) => error instanceof MediaSourceError && error.code === "podcast_transcript_unavailable",
    );
  });
});

describe("video learning service", () => {
  it("creates a grounded session and answers from timestamped transcript pages", async () => {
    const session = await createVideoSession(`https://www.youtube.com/watch?v=${videoId}`, {
      fetchImpl: youtubeFetch as typeof fetch,
      provider: demoStudyProvider,
      id: "video-session-test",
      now: "2026-07-23T20:00:00.000Z",
    });
    assert.equal(session.id, "video-session-test");
    assert.equal(session.provider.mode, "demo");
    assert.ok(session.summary.keyConcepts.length >= 3);
    const asked = await askVideoSession(session, "How are weights used?", demoStudyProvider, "2026-07-23T20:01:00.000Z");
    assert.equal(asked.session.messages.length, 2);
    assert.equal(asked.result.grounded, true);
    assert.match(asked.result.citations[0].label, /^0:00–0:14$/);
  });
});
