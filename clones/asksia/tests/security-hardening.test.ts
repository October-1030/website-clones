import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { safeLocalRedirect } from "../src/lib/http/safe-redirect";
import {
  assertPublicDeploymentConfig,
  getCanonicalAppOrigin,
  getDeploymentMode,
  getSupabasePublicConfig,
} from "../src/lib/cloud/config";
import { RequestLimitError, requireDeclaredBodySize } from "../src/lib/http/request-limit";
import { readResponseText, ResponseLimitError } from "../src/lib/http/response-limit";
import { requireSameOriginMutation } from "../src/lib/http/same-origin";
import { demoStudyProvider } from "../src/lib/study/provider";
import { createVideoSession } from "../src/lib/video/service";
import { POST as importLocalSessions } from "../src/app/api/cloud/import-local/route";

const savedEnvironment = {
  STUDYPAL_DEPLOYMENT_MODE: process.env.STUDYPAL_DEPLOYMENT_MODE,
  STUDYPAL_APP_ORIGIN: process.env.STUDYPAL_APP_ORIGIN,
};

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("production configuration boundary", () => {
  it("defaults to local and requires a complete public HTTPS boundary", () => {
    assert.equal(getDeploymentMode({}), "local");
    assert.equal(getDeploymentMode({ NODE_ENV: "production" }), "public");
    assert.throws(
      () => getDeploymentMode({ STUDYPAL_DEPLOYMENT_MODE: "publci" }),
      /either "local" or "public"/,
    );
    assert.equal(getCanonicalAppOrigin({ STUDYPAL_APP_ORIGIN: "https://study.example" }), "https://study.example");
    assert.throws(
      () => getCanonicalAppOrigin({ STUDYPAL_APP_ORIGIN: "http://study.example/path" }),
      /HTTPS origin/,
    );
    assert.throws(
      () => assertPublicDeploymentConfig({ STUDYPAL_DEPLOYMENT_MODE: "public" }),
      /CLOUD_MODE=required/,
    );
    const environment = {
      STUDYPAL_DEPLOYMENT_MODE: "public",
      STUDYPAL_APP_ORIGIN: "https://study.example",
      STUDYPAL_CLOUD_MODE: "required",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    };
    assert.doesNotThrow(() => assertPublicDeploymentConfig(environment));
    assert.equal(getSupabasePublicConfig(environment)?.url, "https://project.supabase.co");
    assert.throws(
      () => getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never_public",
      }),
      /secret/,
    );
  });

  it("blocks cross-origin local cloud imports before parsing or cloud access", async () => {
    process.env.STUDYPAL_DEPLOYMENT_MODE = "local";
    const response = await importLocalSessions(new Request("http://127.0.0.1:3000/api/cloud/import-local", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Origin: "http://127.0.0.1:4000",
        "Sec-Fetch-Site": "same-site",
      },
      body: JSON.stringify({ confirmation: "IMPORT_LOCAL_SESSIONS" }),
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { code: string }).code, "request_origin_blocked");
  });

  it("uses only the canonical public origin for unsafe requests", () => {
    process.env.STUDYPAL_DEPLOYMENT_MODE = "public";
    process.env.STUDYPAL_APP_ORIGIN = "https://study.example";
    const accepted = new Request("https://internal.invalid/api/cloud/profile", {
      method: "POST",
      headers: { Origin: "https://study.example", "Sec-Fetch-Site": "same-origin" },
    });
    assert.doesNotThrow(() => requireSameOriginMutation(accepted));
    const rejected = new Request("https://internal.invalid/api/cloud/profile", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    });
    assert.throws(() => requireSameOriginMutation(rejected), /StudyPal/);
  });
});

describe("bounded request and response helpers", () => {
  it("requires and enforces a declared request size", () => {
    const accepted = new Request("https://study.example/api/test", {
      method: "POST",
      headers: { "Content-Length": "12" },
      body: "hello world!",
    });
    assert.equal(requireDeclaredBodySize(accepted, 12), 12);
    const missing = new Request("https://study.example/api/test", { method: "POST" });
    assert.throws(
      () => requireDeclaredBodySize(missing, 12),
      (error: unknown) => error instanceof RequestLimitError && error.status === 411,
    );
    const oversized = new Request("https://study.example/api/test", {
      method: "POST",
      headers: { "Content-Length": "13" },
      body: "hello world!!",
    });
    assert.throws(() => requireDeclaredBodySize(oversized, 12), /too large/i);
  });

  it("cancels a remote stream once its byte budget is exceeded", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
      },
      cancel() {
        cancelled = true;
      },
    }));
    await assert.rejects(
      readResponseText(response, 10),
      (error: unknown) => error instanceof ResponseLimitError,
    );
    assert.equal(cancelled, true);
  });
});

describe("redirect, provider order, and migration hardening", () => {
  it("keeps auth callback redirects on the current origin", () => {
    assert.equal(safeLocalRedirect("/pro/session?tab=library"), "/pro/session?tab=library");
    for (const value of ["//evil.example", "/\\evil.example", "https://evil.example", null]) {
      assert.equal(safeLocalRedirect(value), "/pro/session");
    }
  });

  it("runs the video quota hook after source validation but before model work", async () => {
    let quotaChecked = false;
    const provider = {
      ...demoStudyProvider,
      async summarize(document: Parameters<typeof demoStudyProvider.summarize>[0]) {
        assert.equal(quotaChecked, true);
        return demoStudyProvider.summarize(document);
      },
    };
    const transcript = "Spaced repetition schedules review before memories fade. Active recall strengthens retrieval.";
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "PodcastEpisode",
      name: "Memory",
      transcript,
    })}</script>`;
    const session = await createVideoSession("https://example.com/episode", {
      environment: { ...process.env, STUDYPAL_MEDIA_ALLOWED_HOSTS: "example.com" },
      fetchImpl: (() => Promise.resolve(new Response(html))) as typeof fetch,
      provider,
      beforeSummarize: async () => {
        quotaChecked = true;
      },
    });
    assert.equal(quotaChecked, true);
    assert.equal(session.source.title, "Memory");
  });

  it("uses accurate transcription privacy and cleanup wording", async () => {
    const workspace = await readFile(path.resolve("src/components/TranscribeWorkspace.tsx"), "utf8");
    assert.doesNotMatch(workspace, /sent only to this computer/i);
    assert.doesNotMatch(workspace, /deleted immediately/i);
    assert.match(workspace, /uploaded to the StudyPal server/i);
    assert.match(workspace, /attempts to remove the temporary file/i);

    const route = await readFile(path.resolve("src/lib/transcribe/route-handler.ts"), "utf8");
    assert.match(route, /could not remove a temporary transcription file/);
    assert.doesNotMatch(route, /console\.warn\([^\n]*temporaryPath/);
  });

  it("emits HSTS even when the build environment is not marked public", async () => {
    const configuration = (await import("../next.config")).default;
    const entries = await configuration.headers?.();
    assert.match(JSON.stringify(entries), /Strict-Transport-Security/);
  });

  it("ships safe public, local, and development launchers", async () => {
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.equal(packageJson.scripts.start, "node scripts/start-public.mjs");
    const publicLauncher = await readFile(path.resolve("scripts/start-public.mjs"), "utf8");
    const localLauncher = await readFile(path.resolve("scripts/start-local.mjs"), "utf8");
    const devLauncher = await readFile(path.resolve("scripts/start-dev.mjs"), "utf8");
    assert.match(publicLauncher, /STUDYPAL_DEPLOYMENT_MODE: "public"/);
    assert.match(localLauncher, /STUDYPAL_DEPLOYMENT_MODE: "local"/);
    assert.match(devLauncher, /"127\.0\.0\.1"/);
  });

  it("ships database owner constraints, payload caps, and column-level plan protection", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260724100000_production_security_hardening.sql"),
      "utf8",
    );
    assert.match(sql, /revoke update on table public\.profiles from authenticated/i);
    assert.match(sql, /grant update \(display_name, preferences\)/i);
    assert.match(sql, /learning_sessions_payload_size_check/i);
    assert.match(sql, /learning_artifacts_payload_size_check/i);
    assert.match(sql, /pg_advisory_xact_lock/i);
    assert.match(sql, /lms_courses_owner_connection_fk/i);
    assert.match(sql, /lms_materials_owner_course_fk/i);
    assert.match(sql, /lms_sync_runs_owner_connection_fk/i);
    assert.match(sql, /set search_path = ''/i);
  });

  it("keeps quota consumption before every expensive provider invocation", async () => {
    const files = [
      ["src/app/api/study/extract/route.ts", "consumeAccountUsage", "provider.summarize"],
      ["src/app/api/study/ask/route.ts", "consumeAccountUsage", "provider.answer"],
      ["src/app/api/homework/solve/route.ts", "consumeAccountUsage", "provider.solveHomework"],
      ["src/app/api/video/ask/route.ts", "consumeAccountUsage", "askVideoSession"],
    ] as const;
    for (const [file, quota, provider] of files) {
      const source = await readFile(path.resolve(file), "utf8");
      const operationStart = source.indexOf("try");
      assert.ok(source.indexOf(quota, operationStart) < source.indexOf(provider, operationStart), file);
    }
  });

  it("probes audio duration and consumes quota before Faster-Whisper transcription", async () => {
    const route = await readFile(path.resolve("src/lib/transcribe/route-handler.ts"), "utf8");
    const probeIndex = route.indexOf("await durationProbe");
    const quotaIndex = route.indexOf("await consumeAccountUsage", probeIndex);
    const transcribeIndex = route.indexOf("await transcriber", probeIndex);
    assert.ok(probeIndex > 0);
    assert.ok(quotaIndex > probeIndex);
    assert.ok(transcribeIndex > quotaIndex);

    const runner = await readFile(path.resolve("src/lib/transcribe/runner.ts"), "utf8");
    assert.doesNotMatch(runner, /\.\.\.process\.env/);
    assert.match(runner, /HF_HUB_OFFLINE/);

    const python = await readFile(path.resolve("scripts/transcribe-audio.py"), "utf8");
    assert.doesNotMatch(python, /container\.duration/);
    assert.match(python, /container\.decode/);
    assert.ok(python.indexOf("if args.probe_only") < python.indexOf("from faster_whisper import WhisperModel"));
  });
});
