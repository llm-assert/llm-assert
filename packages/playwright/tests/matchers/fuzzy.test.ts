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

test.describe("toSemanticMatch", () => {
  test("passes when semantically similar", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("hello world").toSemanticMatch("hi world");
  });

  test("fails when semantically different", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await baseExpect(async () => {
      await expect("hello").toSemanticMatch("completely unrelated");
    }).rejects.toThrow(/to semantically match reference/);
  });

  test(".not passes when semantically different", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await expect("hello").not.toSemanticMatch("unrelated");
  });

  test(".not fails when semantically similar", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await baseExpect(async () => {
      await expect("hello").not.toSemanticMatch("hi");
    }).rejects.toThrow(/not to semantically match reference/);
  });

  test("respects custom threshold", async () => {
    setWorkerJudgeClient(createMockJudge({ score: 0.75 }));
    await baseExpect(async () => {
      await expect("a").toSemanticMatch("b", { threshold: 0.8 });
    }).rejects.toThrow();
  });

  test("emits attachment to test info", async ({}, testInfo) => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("hello").toSemanticMatch("hi");

    const attachment = testInfo.attachments.find(
      (a) => a.name === "llmassert-eval",
    );
    baseExpect(attachment).toBeDefined();
    const data = JSON.parse(attachment!.body!.toString());
    baseExpect(data.assertionType).toBe("fuzzy");
    baseExpect(data.score).toBe(0.9);
  });
});
