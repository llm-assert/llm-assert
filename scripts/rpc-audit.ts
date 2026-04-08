/* eslint-disable no-console -- CLI script, console is the correct output mechanism */
/**
 * RPC Security Audit — static lint for Supabase migration files.
 *
 * Checks all CREATE [OR REPLACE] FUNCTION statements in *.sql files for:
 *   R1  SECURITY DEFINER on public functions
 *   R2  SET search_path = '' on all functions
 *   R3  REVOKE EXECUTE FROM public on public non-trigger functions
 *   R4  REVOKE EXECUTE FROM anon on public non-trigger functions
 *   R5  auth.uid() wrapped in (select auth.uid()) inside function bodies
 *
 * Usage:
 *   pnpm run rpc-audit                      # scans supabase/migrations/
 *   npx tsx scripts/rpc-audit.ts /some/dir   # scans custom directory
 *
 * Exit codes: 0 = pass, 1 = violations found, 2 = script error
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleId = "R1" | "R2" | "R3" | "R4" | "R5";

interface Violation {
  file: string;
  line: number;
  rule: RuleId;
  fn: string;
  message: string;
}

interface ParsedFunction {
  name: string;
  schema: string;
  line: number;
  /** Full text of the CREATE … $$ … $$; block */
  block: string;
  isTrigger: boolean;
  disabledRules: Set<RuleId>;
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

/** Strip SQL comments, preserving line structure (replace with spaces). */
function stripComments(sql: string): string {
  // Block comments: /* ... */
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  // Line comments: -- ...
  result = result.replace(/--.*/g, (m) => " ".repeat(m.length));
  return result;
}

/** Extract all CREATE [OR REPLACE] FUNCTION blocks from stripped SQL. */
function extractFunctions(
  strippedSql: string,
  rawSql: string,
): ParsedFunction[] {
  const fns: ParsedFunction[] = [];

  const createRe =
    /create\s+(?:or\s+replace\s+)?function\s+(?:(\w+)\.)?(\w+)\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = createRe.exec(strippedSql)) !== null) {
    const schema = match[1] ?? "public";
    const name = match[2];
    const startIdx = match.index;
    const line = strippedSql.slice(0, startIdx).split("\n").length;

    // Find the end of this statement — look for the body delimiters ($$)
    const afterCreate = strippedSql.slice(startIdx);

    // Find first $$ (body open)
    const bodyOpenIdx = afterCreate.indexOf("$$");
    if (bodyOpenIdx === -1) {
      // No body — still check header
      const endIdx = afterCreate.indexOf(";");
      const block = afterCreate.slice(
        0,
        endIdx !== -1 ? endIdx + 1 : undefined,
      );
      const isTrigger = /returns\s+trigger/i.test(block);
      const disabledRules = collectDisabledRules(rawSql, line);
      fns.push({ name, schema, line, block, isTrigger, disabledRules });
      continue;
    }

    // Find matching closing $$
    const bodyCloseIdx = afterCreate.indexOf("$$", bodyOpenIdx + 2);
    if (bodyCloseIdx === -1) continue;

    // Extend to the next semicolon after the closing $$
    const afterBody = afterCreate.slice(bodyCloseIdx + 2);
    const semiIdx = afterBody.indexOf(";");
    const blockEnd = bodyCloseIdx + 2 + (semiIdx !== -1 ? semiIdx + 1 : 0);
    const block = afterCreate.slice(0, blockEnd);

    const isTrigger = /returns\s+trigger/i.test(block.slice(0, bodyOpenIdx));
    const disabledRules = collectDisabledRules(rawSql, line);

    fns.push({ name, schema, line, block, isTrigger, disabledRules });
  }

  return fns;
}

/** Collect rpc-lint-disable annotations within 5 lines before the function. */
function collectDisabledRules(rawSql: string, fnLine: number): Set<RuleId> {
  const lines = rawSql.split("\n");
  const disabled = new Set<RuleId>();
  const start = Math.max(0, fnLine - 6); // 5 lines before (1-indexed fnLine)

  for (let i = start; i < fnLine - 1 && i < lines.length; i++) {
    const m = lines[i].match(/--\s*rpc-lint-disable:\s*(.+)/i);
    if (m) {
      for (const rule of m[1].split(",")) {
        const trimmed = rule.trim().toUpperCase() as RuleId;
        if (["R1", "R2", "R3", "R4", "R5"].includes(trimmed)) {
          disabled.add(trimmed);
        }
      }
    }
  }

  return disabled;
}

// ---------------------------------------------------------------------------
// Rule checks
// ---------------------------------------------------------------------------

function checkR1(fn: ParsedFunction): string | null {
  if (fn.schema !== "public") return null;
  if (/security\s+definer/i.test(fn.block)) return null;
  return `public.${fn.name}() missing SECURITY DEFINER — https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker`;
}

function checkR2(fn: ParsedFunction): string | null {
  if (/set\s+search_path\s*=\s*''/i.test(fn.block)) return null;
  if (/set\s+search_path\s+to\s+''/i.test(fn.block)) return null;
  return `${fn.schema}.${fn.name}() missing SET search_path = '' — https://supabase.com/docs/guides/database/functions#search-path`;
}

function checkR3(fn: ParsedFunction, fileText: string): string | null {
  if (fn.schema !== "public") return null;
  if (fn.isTrigger) return null;
  const revokeRe = new RegExp(
    `revoke\\s+execute\\s+on\\s+function\\s+(?:public\\.)?${fn.name}\\b[^;]*from\\s+public`,
    "is",
  );
  if (revokeRe.test(fileText)) return null;
  return `public.${fn.name}() missing REVOKE EXECUTE FROM public — https://supabase.com/docs/guides/database/functions#grant-and-revoke`;
}

function checkR4(fn: ParsedFunction, fileText: string): string | null {
  if (fn.schema !== "public") return null;
  if (fn.isTrigger) return null;
  const revokeRe = new RegExp(
    `revoke\\s+execute\\s+on\\s+function\\s+(?:public\\.)?${fn.name}\\b[^;]*from\\s+anon`,
    "is",
  );
  if (revokeRe.test(fileText)) return null;
  return `public.${fn.name}() missing REVOKE EXECUTE FROM anon — https://supabase.com/docs/guides/database/functions#grant-and-revoke`;
}

function checkR5(fn: ParsedFunction): Violation[] {
  const violations: Violation[] = [];

  // Find the function body between $$ delimiters
  const bodyOpenIdx = fn.block.indexOf("$$");
  if (bodyOpenIdx === -1) return violations;
  const bodyCloseIdx = fn.block.indexOf("$$", bodyOpenIdx + 2);
  if (bodyCloseIdx === -1) return violations;
  const body = fn.block.slice(bodyOpenIdx + 2, bodyCloseIdx);

  // Calculate line offset from CREATE to the $$ body open
  const headerLines = fn.block.slice(0, bodyOpenIdx + 2).split("\n").length - 1;

  // Check each line of the body for bare auth.uid()
  const bodyLines = body.split("\n");
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    // Match auth.uid() NOT preceded by "(select "
    if (/(?<!\(\s*select\s+)auth\.uid\(\)/i.test(line)) {
      violations.push({
        file: "", // filled by caller
        line: fn.line + headerLines + i,
        rule: "R5",
        fn: `${fn.schema}.${fn.name}`,
        message: `${fn.schema}.${fn.name}() has bare auth.uid() — wrap in (select auth.uid()) — https://supabase.com/docs/guides/database/functions#auth-uid`,
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function auditFile(filePath: string, displayPath: string): Violation[] {
  const rawSql = readFileSync(filePath, "utf-8");
  const stripped = stripComments(rawSql);
  const fns = extractFunctions(stripped, rawSql);
  const violations: Violation[] = [];

  for (const fn of fns) {
    const rules: [RuleId, () => string | null][] = [
      ["R1", () => checkR1(fn)],
      ["R2", () => checkR2(fn)],
      ["R3", () => checkR3(fn, stripped)],
      ["R4", () => checkR4(fn, stripped)],
    ];

    for (const [rule, check] of rules) {
      if (fn.disabledRules.has(rule)) continue;
      const msg = check();
      if (msg) {
        violations.push({
          file: displayPath,
          line: fn.line,
          rule,
          fn: `${fn.schema}.${fn.name}`,
          message: msg,
        });
      }
    }

    // R5 — per-line violations
    if (!fn.disabledRules.has("R5")) {
      for (const v of checkR5(fn)) {
        violations.push({ ...v, file: displayPath });
      }
    }
  }

  return violations;
}

function main() {
  const dir = process.argv[2]
    ? resolve(process.argv[2])
    : join(process.cwd(), "supabase", "migrations");

  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(dir, f));
  } catch (err) {
    console.error(`ERROR: Cannot read directory: ${dir}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  if (files.length === 0) {
    console.log(`No .sql files found in ${dir}`);
    process.exit(0);
  }

  const allViolations: Violation[] = [];

  for (const filePath of files) {
    const displayPath = filePath.replace(process.cwd() + "/", "");
    allViolations.push(...auditFile(filePath, displayPath));
  }

  if (allViolations.length === 0) {
    console.log(
      `rpc-audit: ${files.length} migration files scanned, 0 violations.`,
    );
    process.exit(0);
  }

  for (const v of allViolations) {
    console.log(`${v.file}:${v.line} — ${v.rule}: ${v.message}`);
  }
  console.log(
    `\nrpc-audit: ${allViolations.length} violation(s) in ${files.length} files.`,
  );
  process.exit(1);
}

// Export for testing
export {
  stripComments,
  extractFunctions,
  collectDisabledRules,
  auditFile,
  type Violation,
  type ParsedFunction,
  type RuleId,
};

// Only run main() when executed directly, not when imported for tests
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
