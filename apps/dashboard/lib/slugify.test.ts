import { validateSlug, nameToSlug } from "./slugify";

describe("validateSlug", () => {
  it("returns null for a valid slug", () => {
    expect(validateSlug("my-project")).toBeNull();
  });

  it("returns null for a single character slug", () => {
    expect(validateSlug("a")).toBeNull();
  });

  it("returns null for numeric slug", () => {
    expect(validateSlug("123")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateSlug("")).toBe("Slug is required");
  });

  it("rejects slugs over 64 characters", () => {
    const long = "a".repeat(65);
    expect(validateSlug(long)).toMatch(/64 characters/);
  });

  it("accepts exactly 64 characters", () => {
    const exact = "a".repeat(64);
    expect(validateSlug(exact)).toBeNull();
  });

  it("rejects uppercase characters", () => {
    expect(validateSlug("My-Project")).toMatch(/lowercase/);
  });

  it("rejects spaces", () => {
    expect(validateSlug("my project")).toMatch(/lowercase/);
  });

  it("rejects leading hyphen", () => {
    expect(validateSlug("-my-project")).toMatch(
      /cannot start or end with a hyphen/,
    );
  });

  it("rejects trailing hyphen", () => {
    expect(validateSlug("my-project-")).toMatch(
      /cannot start or end with a hyphen/,
    );
  });

  it("rejects special characters", () => {
    expect(validateSlug("my_project!")).toMatch(/lowercase/);
  });
});

describe("nameToSlug", () => {
  it("converts spaces to hyphens", () => {
    expect(nameToSlug("My Project")).toBe("my-project");
  });

  it("lowercases the input", () => {
    expect(nameToSlug("UPPERCASE")).toBe("uppercase");
  });

  it("removes special characters", () => {
    expect(nameToSlug("Hello, World!")).toBe("hello-world");
  });

  it("collapses consecutive hyphens", () => {
    expect(nameToSlug("a   b   c")).toBe("a-b-c");
  });

  it("strips leading and trailing hyphens", () => {
    expect(nameToSlug("  hello  ")).toBe("hello");
  });

  it("truncates to 64 characters", () => {
    const long = "a ".repeat(40); // 80 chars worth
    expect(nameToSlug(long).length).toBeLessThanOrEqual(64);
  });

  it("handles empty string", () => {
    expect(nameToSlug("")).toBe("");
  });

  it("handles string with only special chars", () => {
    expect(nameToSlug("!!!")).toBe("");
  });
});
