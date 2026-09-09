// Run after starting the local QA provider (3039) and a build on port 3018
// with WRITING_BASE_URL=http://127.0.0.1:3039 and a dummy WRITING_API_KEY.
import assert from "node:assert/strict";
import { defaultOpening } from "../src/lib/golden-opening.ts";

const endpoint = "http://localhost:3018/api/golden-opening";
const post = (theme, extra = {}, origin) => fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ input: { ...defaultOpening, theme }, connection: "server", ...extra }) });
assert.equal((await fetch(endpoint).then(response => response.json())).model, "local-qa-fixture");
assert.equal((await post(" ")).status, 400);
assert.equal((await post("test", {}, "https://example.invalid")).status, 403);
assert.equal((await post("test", { connection: "deepseek", apiKey: "", model: "deepseek-v4-flash" })).status, 400);
const unconfigured = await fetch("http://localhost:3017/api/golden-opening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { ...defaultOpening, theme: "test" }, connection: "server" }) });
assert.equal(unconfigured.status, 503);
const success = await post("接口回归测试");
assert.equal(success.status, 200);
const events = (await success.text()).trim().split("\n").map(line => JSON.parse(line));
assert.equal(events.at(-1).type, "done");
assert.match(events.filter(event => event.type === "delta").map(event => event.text).join(""), /不是 AI 生成内容/);
const auth = await post("QA_AUTH_ERROR");
assert.equal(auth.status, 502);
assert.match((await auth.json()).error, /鉴权失败/);
const truncated = (await (await post("QA_TRUNCATED")).text()).trim().split("\n").map(line => JSON.parse(line));
assert.equal(truncated.at(-1).type, "error");
assert.match(truncated.at(-1).error, /连接中断/);
console.log("PASS: configuration, validation, origin, missing key, streaming, upstream auth failure, truncated stream.");
