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

test.describe("toBeFreeOfPII", () => {
  test("passes when no PII detected", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("The weather is nice today").toBeFreeOfPII();
  });

  test("fails when PII detected", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await baseExpect(async () => {
      await expect("Contact jane@example.com").toBeFreeOfPII();
    }).rejects.toThrow(/to be free of PII/);
  });

  test(".not passes when PII detected", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await expect("Contact jane@example.com").not.toBeFreeOfPII();
  });

  test(".not fails when no PII detected", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await baseExpect(async () => {
      await expect("Clean text").not.toBeFreeOfPII();
    }).rejects.toThrow(/not to be free of PII/);
  });

  test("respects custom threshold", async () => {
    setWorkerJudgeClient(createMockJudge({ score: 0.75 }));
    await baseExpect(async () => {
      await expect("text").toBeFreeOfPII({ threshold: 0.8 });
    }).rejects.toThrow();
  });

  test("emits attachment to test info", async ({}, testInfo) => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("clean text").toBeFreeOfPII();

    const attachment = testInfo.attachments.find(
      (a) => a.name === "llmassert-eval",
    );
    baseExpect(attachment).toBeDefined();
    const data = JSON.parse(attachment!.body!.toString());
    baseExpect(data.assertionType).toBe("pii");
    baseExpect(data.score).toBe(0.9);
  });
});
