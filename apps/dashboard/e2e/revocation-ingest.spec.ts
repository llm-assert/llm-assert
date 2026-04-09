import { test, expect } from "@playwright/test";
import {
  seedTestData,
  cleanupTestData,
  buildTestIngestPayload,
  type SeededTestData,
} from "./fixtures/db-seed";

test.describe("API key revocation → ingest rejection", () => {
  test.describe.configure({ mode: "serial" });

  let seed: SeededTestData;
  let revokedResponseBody: unknown;

  test.beforeAll(async () => {
    seed = await seedTestData();
  });

  test.afterAll(async () => {
    if (seed) {
      await cleanupTestData(seed.admin, seed.userId);
    }
  });

  test("active key returns 200", async ({ request }) => {
    const payload = buildTestIngestPayload(seed.projectSlug);

    const response = await request.post("/api/ingest", {
      headers: { Authorization: `Bearer ${seed.rawApiKey}` },
      data: payload,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.run_id).toBeTruthy();
    expect(body.evaluations_ingested).toBeGreaterThanOrEqual(1);
  });

  test("revoked key returns 401", async ({ request }) => {
    // Capture last_used_at before revocation to verify it doesn't change
    const { data: keyBefore } = await seed.admin
      .from("api_keys")
      .select("last_used_at")
      .eq("id", seed.apiKeyId)
      .single();

    // Revoke the key
    const { error } = await seed.admin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", seed.apiKeyId);
    expect(error).toBeNull();

    const payload = buildTestIngestPayload(seed.projectSlug);

    const response = await request.post("/api/ingest", {
      headers: { Authorization: `Bearer ${seed.rawApiKey}` },
      data: payload,
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    revokedResponseBody = body;

    // Side-channel: last_used_at should NOT be updated (success path updates it)
    const { data: keyAfter } = await seed.admin
      .from("api_keys")
      .select("last_used_at")
      .eq("id", seed.apiKeyId)
      .single();
    expect(keyAfter?.last_used_at).toBe(keyBefore?.last_used_at);
  });

  test("revoked key on preflight returns 401", async ({ request }) => {
    const response = await request.get(
      `/api/ingest/preflight?project_slug=${seed.projectSlug}`,
      {
        headers: { Authorization: `Bearer ${seed.rawApiKey}` },
      },
    );

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("nonexistent key returns 401 with identical structure", async ({
    request,
  }) => {
    const payload = buildTestIngestPayload(seed.projectSlug);

    const response = await request.post("/api/ingest", {
      headers: { Authorization: "Bearer lma_boguskey123" },
      data: payload,
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");

    // No key-existence oracle: response structure must be identical to revoked key
    expect(body).toEqual(revokedResponseBody);
  });
});
