import { test as baseTest, expect as baseExpect } from "@playwright/test";
import { expect } from "../../src/index.js";
import { setWorkerJudgeClient } from "../../src/singleton.js";
import {
  createMockJudge,
  mockPassingJudge,
  mockFailingJudge,
} from "../helpers/mock-judge.js";

const test = baseTest;

test.afterEach(() => {
  setWorkerJudgeClient(null);
});

test.describe("toBeFormatCompliant", () => {
  test("passes when format is compliant", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect('{"key": "value"}').toBeFormatCompliant("JSON object");
  });

  test("fails when format is non-compliant", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await baseExpect(async () => {
      await expect("plain text").toBeFormatCompliant("JSON object");
    }).rejects.toThrow(/to comply with format/);
  });

  test(".not passes when format is non-compliant", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await expect("plain text").not.toBeFormatCompliant("JSON object");
  });

  test(".not fails when format is compliant", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await baseExpect(async () => {
      await expect("{}").not.toBeFormatCompliant("JSON object");
    }).rejects.toThrow(/not to comply with format/);
  });

  test("respects custom threshold", async () => {
    setWorkerJudgeClient(createMockJudge({ score: 0.75 }));
    await baseExpect(async () => {
      await expect("{}").toBeFormatCompliant("JSON", { threshold: 0.8 });
    }).rejects.toThrow();
  });

  test("emits attachment to test info", async ({}, testInfo) => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("{}").toBeFormatCompliant("JSON");

    const attachment = testInfo.attachments.find(
      (a) => a.name === "llmassert-eval",
    );
    baseExpect(attachment).toBeDefined();
    const data = JSON.parse(attachment!.body!.toString());
    baseExpect(data.assertionType).toBe("schema");
  });
});
