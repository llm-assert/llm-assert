import { IngestPayloadSchema } from "../schema";
import {
  buildIngestPayload,
  assertFactoryDefaults,
} from "@/test/factories";

describe("IngestPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const payload = buildIngestPayload();
    const result = IngestPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("factory defaults are always valid (self-test)", () => {
    expect(() => assertFactoryDefaults()).not.toThrow();
  });

  describe("project_slug validation", () => {
    it("rejects uppercase characters", () => {
      const payload = buildIngestPayload({ project_slug: "My-Project" });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects special characters", () => {
      const payload = buildIngestPayload({ project_slug: "my_project!" });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects empty string", () => {
      const payload = buildIngestPayload({ project_slug: "" });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts lowercase with hyphens", () => {
      const payload = buildIngestPayload({ project_slug: "my-cool-project" });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("run_id validation", () => {
    it("rejects non-UUID strings", () => {
      const payload = buildIngestPayload({ run_id: "not-a-uuid" });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("evaluations array", () => {
    it("rejects empty evaluations array", () => {
      const payload = buildIngestPayload();
      payload.evaluations = [];
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts up to 500 evaluations", () => {
      const payload = buildIngestPayload({
        evaluations: Array.from({ length: 500 }, () => ({})),
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects more than 500 evaluations", () => {
      const payload = buildIngestPayload({
        evaluations: Array.from({ length: 501 }, () => ({})),
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("score-result cross-field constraint", () => {
    it("rejects null score with pass result", () => {
      const payload = buildIngestPayload({
        evaluations: [{ result: "pass", score: null }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects null score with fail result", () => {
      const payload = buildIngestPayload({
        evaluations: [{ result: "fail", score: null }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts null score with inconclusive result", () => {
      const payload = buildIngestPayload({
        evaluations: [{ result: "inconclusive", score: null }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("accepts numeric score with pass result", () => {
      const payload = buildIngestPayload({
        evaluations: [{ result: "pass", score: 0.85 }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("evaluation field validation", () => {
    it("rejects score above 1", () => {
      const payload = buildIngestPayload({
        evaluations: [{ score: 1.5 }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects score below 0", () => {
      const payload = buildIngestPayload({
        evaluations: [{ score: -0.1 }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects negative latency", () => {
      const payload = buildIngestPayload({
        evaluations: [{ judge_latency_ms: -100 }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects unknown assertion type", () => {
      const payload = buildIngestPayload({
        evaluations: [{ assertion_type: "unknown" }],
      });
      const result = IngestPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts all valid assertion types", () => {
      for (const type of [
        "groundedness",
        "pii",
        "sentiment",
        "schema",
        "fuzzy",
      ]) {
        const payload = buildIngestPayload({
          evaluations: [{ assertion_type: type }],
        });
        const result = IngestPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });
  });
});
