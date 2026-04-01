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

test.describe("toBeGroundedIn", () => {
  test("passes when judge scores high", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("The sky is blue").toBeGroundedIn("The sky appears blue");
  });

  test("fails when judge scores low", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await baseExpect(async () => {
      await expect("Hallucinated text").toBeGroundedIn("Unrelated context");
    }).rejects.toThrow(/to be grounded in context/);
  });

  test(".not passes when judge scores low", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await expect("Ungrounded text").not.toBeGroundedIn("Source context");
  });

  test(".not fails when judge scores high", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await baseExpect(async () => {
      await expect("Grounded text").not.toBeGroundedIn("Source context");
    }).rejects.toThrow(/not to be grounded in context/);
  });

  test("respects custom threshold", async () => {
    setWorkerJudgeClient(createMockJudge({ score: 0.75 }));
    // 0.75 < 0.8 threshold → should fail
    await baseExpect(async () => {
      await expect("text").toBeGroundedIn("context", { threshold: 0.8 });
    }).rejects.toThrow();
  });

  test("emits attachment to test info", async ({}, testInfo) => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("text").toBeGroundedIn("context");

    const attachment = testInfo.attachments.find(
      (a) => a.name === "llmassert-eval",
    );
    baseExpect(attachment).toBeDefined();
    baseExpect(attachment!.contentType).toBe("application/json");

    const data = JSON.parse(attachment!.body!.toString());
    baseExpect(data.assertionType).toBe("groundedness");
    baseExpect(data.score).toBe(0.9);
    baseExpect(typeof data.reasoning).toBe("string");
    baseExpect(typeof data.threshold).toBe("number");
  });
});
