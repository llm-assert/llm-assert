import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditFile } from "../rpc-audit.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function audit(fixture: string) {
  const dir = join(FIXTURES, fixture);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  if (files.length === 0) throw new Error(`No .sql files in ${dir}`);
  return files.flatMap((f) => auditFile(join(dir, f), f));
}

// ---------------------------------------------------------------------------
// Passing fixtures
// ---------------------------------------------------------------------------

describe("valid fixtures", () => {
  it("authenticated + service_role RPCs pass all rules", () => {
    const v = audit("valid");
    assert.equal(
      v.length,
      0,
      `Expected 0 violations, got: ${JSON.stringify(v)}`,
    );
  });

  it("auth.uid() in SQL comments does not trigger R5", () => {
    // valid/001 has "auth.uid()" in a comment inside the function body —
    // comment stripping must prevent a false R5 violation
    const v = audit("valid");
    const r5 = v.filter((x) => x.rule === "R5");
    assert.equal(
      r5.length,
      0,
      `Comment-stripping failed: ${JSON.stringify(r5)}`,
    );
  });
});

describe("private-schema fixture", () => {
  it("private schema function passes (R1/R3/R4 exempt)", () => {
    const v = audit("private-schema");
    assert.equal(
      v.length,
      0,
      `Expected 0 violations, got: ${JSON.stringify(v)}`,
    );
  });
});

describe("trigger fixture", () => {
  it("trigger function passes (R3/R4 exempt)", () => {
    const v = audit("trigger");
    assert.equal(
      v.length,
      0,
      `Expected 0 violations, got: ${JSON.stringify(v)}`,
    );
  });
});

describe("lint-disable fixture", () => {
  it("disabled rules are skipped", () => {
    const v = audit("lint-disable");
    assert.equal(
      v.length,
      0,
      `Expected 0 violations, got: ${JSON.stringify(v)}`,
    );
  });
});

describe("no-functions fixture", () => {
  it("DDL-only file passes", () => {
    const v = audit("no-functions");
    assert.equal(
      v.length,
      0,
      `Expected 0 violations, got: ${JSON.stringify(v)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Failing fixtures
// ---------------------------------------------------------------------------

describe("R1 fixture", () => {
  it("detects missing SECURITY DEFINER", () => {
    const v = audit("r1");
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "R1");
    assert.match(v[0].message, /SECURITY DEFINER/);
  });
});

describe("R2 fixture", () => {
  it("detects missing search_path", () => {
    const v = audit("r2");
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "R2");
    assert.match(v[0].message, /search_path/);
  });
});

describe("R3 fixture", () => {
  it("detects missing REVOKE FROM public", () => {
    const v = audit("r3");
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "R3");
    assert.match(v[0].message, /REVOKE EXECUTE FROM public/);
  });
});

describe("R4 fixture", () => {
  it("detects missing REVOKE FROM anon", () => {
    const v = audit("r4");
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "R4");
    assert.match(v[0].message, /REVOKE EXECUTE FROM anon/);
  });
});

describe("R5 fixture", () => {
  it("detects bare auth.uid() with correct line number", () => {
    const v = audit("r5");
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "R5");
    assert.match(v[0].message, /bare auth\.uid\(\)/);
    // Line should point to the bare auth.uid() usage inside the body,
    // not the CREATE statement
    assert.ok(v[0].line > 2, `Expected line inside body, got ${v[0].line}`);
  });
});
