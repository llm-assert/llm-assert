/** Input sanitization and validation utilities for judge prompts */

/** Control sequence patterns that may indicate prompt injection */
const CONTROL_SEQUENCE_PATTERN =
  /^(System:|Assistant:|Human:|\[INST\]|---\s*$)/im;

/**
 * Strip known prompt injection control sequences from user text.
 * Removes lines that start with role markers or separator patterns.
 */
export function stripControlSequences(text: string): {
  text: string;
  stripped: boolean;
} {
  const lines = text.split("\n");
  let stripped = false;

  const filtered = lines.filter((line) => {
    if (CONTROL_SEQUENCE_PATTERN.test(line)) {
      stripped = true;
      return false;
    }
    return true;
  });

  return {
    text: stripped ? filtered.join("\n") : text,
    stripped,
  };
}

/**
 * Estimate token count from character length.
 * Conservative heuristic: ~4 characters per token for English.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validate combined input length against the token budget.
 * Returns validation result with potentially truncated texts.
 */
export function validateInputLength(
  inputs: string[],
  maxChars: number,
  handling: "reject" | "truncate",
): {
  valid: boolean;
  truncated: boolean;
  texts: string[];
  reason?: string;
} {
  const totalLength = inputs.reduce((sum, t) => sum + t.length, 0);

  if (totalLength <= maxChars) {
    return { valid: true, truncated: false, texts: inputs };
  }

  if (handling === "reject") {
    return {
      valid: false,
      truncated: false,
      texts: inputs,
      reason: `Input exceeds maximum length (${totalLength.toLocaleString()} chars; limit ${maxChars.toLocaleString()})`,
    };
  }

  // Truncate mode: distribute the budget proportionally across inputs
  const result: string[] = [];
  let remaining = maxChars;

  for (let i = 0; i < inputs.length; i++) {
    const proportion = inputs[i].length / totalLength;
    const budget = Math.floor(maxChars * proportion);
    const allowance = Math.min(inputs[i].length, budget, remaining);
    result.push(
      inputs[i].length > allowance
        ? inputs[i].slice(0, allowance) + " [truncated]"
        : inputs[i],
    );
    remaining -= allowance;
  }

  return { valid: true, truncated: true, texts: result };
}
