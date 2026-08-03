import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { getCaptureNoticeMessage } from "./capture-notice.ts";

test("formats the capture source in the global confirmation", () => {
  strictEqual(getCaptureNoticeMessage("Safari"), "Added to toudou · Safari");
});

test("does not expose captured text in the confirmation", () => {
  strictEqual(getCaptureNoticeMessage(""), "Added to toudou");
});
