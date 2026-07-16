import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REPORTED_LOCATION_ACCURACY_METERS,
  getDistanceMeters,
  validateProjectGeofence,
  validateReportedLocation,
} from "../src/lib/geo.js";

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

test("reported webview locations require bounded coordinates and usable accuracy", () => {
  assert.deepEqual(validateReportedLocation({
    latitude: "-34.5886",
    longitude: "-58.4302",
    accuracy: "18.5",
  }), {
    valid: true,
    latitude: -34.5886,
    longitude: -58.4302,
    accuracy: 18.5,
  });
  assert.deepEqual(
    validateReportedLocation({ latitude: 91, longitude: -58, accuracy: 10 }),
    { valid: false, reason: "INVALID_COORDINATES" },
  );
  assert.deepEqual(
    validateReportedLocation({ latitude: -34, longitude: -58, accuracy: null }),
    { valid: false, reason: "INSUFFICIENT_ACCURACY" },
  );
  assert.deepEqual(
    validateReportedLocation({
      latitude: -34,
      longitude: -58,
      accuracy: MAX_REPORTED_LOCATION_ACCURACY_METERS + 1,
    }),
    { valid: false, reason: "INSUFFICIENT_ACCURACY" },
  );
});

test("tenant geofencing fails closed until real project coordinates are configured", () => {
  assert.deepEqual(validateProjectGeofence({
    latitude: null,
    longitude: null,
    geofenceMeters: 100,
  }), { valid: false });
  assert.deepEqual(validateProjectGeofence({
    latitude: -34.6037,
    longitude: -58.3816,
    geofenceMeters: 120,
  }), {
    valid: true,
    latitude: -34.6037,
    longitude: -58.3816,
    geofenceMeters: 120,
  });
});
