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

test.describe("toMatchTone", () => {
  test("passes when tone matches", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("Thank you for your patience").toMatchTone("professional");
  });

  test("fails when tone does not match", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await baseExpect(async () => {
      await expect("Whatever dude").toMatchTone("professional");
    }).rejects.toThrow(/to match tone/);
  });

  test(".not passes when tone does not match", async () => {
    setWorkerJudgeClient(mockFailingJudge());
    await expect("Whatever dude").not.toMatchTone("professional");
  });

  test(".not fails when tone matches", async () => {
    setWorkerJudgeClient(mockPassingJudge());
    await baseExpect(async () => {
      await expect("Thank you").not.toMatchTone("professional");
    }).rejects.toThrow(/not to match tone/);
  });

  test("respects custom threshold", async () => {
    setWorkerJudgeClient(createMockJudge({ score: 0.75 }));
    await baseExpect(async () => {
      await expect("text").toMatchTone("friendly", { threshold: 0.8 });
    }).rejects.toThrow();
  });

  test("emits attachment to test info", async ({}, testInfo) => {
    setWorkerJudgeClient(mockPassingJudge());
    await expect("kind words").toMatchTone("empathetic");

    const attachment = testInfo.attachments.find(
      (a) => a.name === "llmassert-eval",
    );
    baseExpect(attachment).toBeDefined();
    const data = JSON.parse(attachment!.body!.toString());
    baseExpect(data.assertionType).toBe("sentiment");
  });
});
