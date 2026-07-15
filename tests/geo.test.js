import test from "node:test";
import assert from "node:assert/strict";
import { getDistanceMeters } from "../src/lib/geo.js";

test("distance is zero for the same coordinate", () => {
  assert.equal(getDistanceMeters(-34.5886, -58.4302, -34.5886, -58.4302), 0);
});

test("distance uses degree deltas consistently", () => {
  const distance = getDistanceMeters(-34.5886, -58.4302, -34.5876, -58.4302);
  assert.ok(distance > 110 && distance < 112, `unexpected distance: ${distance}`);
});

test("distance rejects invalid coordinates", () => {
  assert.equal(getDistanceMeters("invalid", 0, 0, 0), null);
});
