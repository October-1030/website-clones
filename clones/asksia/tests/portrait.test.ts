import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTRAIT_MAX_BYTES, portraitCropRect, validatePortraitFile } from "../src/lib/portrait";

describe("local portrait preparation", () => {
  it("accepts supported files and rejects unsafe sizes and types", () => {
    assert.equal(validatePortraitFile({ name: "me.jpg", type: "image/jpeg", size: 100_000 }), null);
    assert.match(validatePortraitFile({ name: "me.svg", type: "image/svg+xml", size: 100 }) || "", /JPEG/);
    assert.match(validatePortraitFile({ name: "huge.png", type: "image/png", size: PORTRAIT_MAX_BYTES + 1 }) || "", /10 MB/);
  });

  it("computes bounded center crops with zoom and position", () => {
    assert.deepEqual(portraitCropRect(1200, 800, 1, 0, 0), { sx: 200, sy: 0, size: 800 });
    const moved = portraitCropRect(1200, 800, 2, 100, -100);
    assert.equal(moved.size, 400);
    assert.equal(moved.sx, 800);
    assert.equal(moved.sy, 0);
  });
});
