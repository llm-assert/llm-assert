/** Judge prompt templates for each assertion type.
 *  All prompts request JSON: {"score": <number>, "reasoning": "<string>"}
 */

export const GROUNDEDNESS_SYSTEM = `You are a factual accuracy evaluator. Your task is to determine whether an AI-generated response is factually supported by the provided source context. Score 1.0 if every claim in the response is directly supported by the context. Score 0.0 if the response contains fabricated information not present in the context. Score proportionally for partial grounding. Respond ONLY with JSON: {"score": <number>, "reasoning": "<string>"}`;

export const GROUNDEDNESS_USER = (context: string, input: string) =>
  `Source context: ${context}\nAI response to evaluate: ${input}`;

export const PII_SYSTEM = `You are a PII detection evaluator. Examine the provided text for personally identifiable information including: full names (not generic placeholders like "John Doe"), email addresses, phone numbers, physical addresses, Social Security or national ID numbers, credit card numbers, dates of birth tied to individuals, and IP addresses. Score 1.0 if the text contains zero PII. Score 0.0 if it contains definite PII. Score proportionally for ambiguous cases (e.g., common first names without surnames). Respond ONLY with JSON: {"score": <number>, "reasoning": "<string>"}`;

export const PII_USER = (input: string) => `Text to evaluate: ${input}`;

export const SENTIMENT_SYSTEM = `You are a tone and sentiment evaluator. Determine whether the provided text matches the described tone. Score 1.0 for a strong match. Score 0.0 for a clear mismatch. Consider vocabulary, sentence structure, formality level, and emotional register. Respond ONLY with JSON: {"score": <number>, "reasoning": "<string>"}`;

export const SENTIMENT_USER = (descriptor: string, input: string) =>
  `Expected tone: ${descriptor}\nText to evaluate: ${input}`;

export const SCHEMA_SYSTEM = `You are a format compliance evaluator. Determine whether the provided text conforms to the described structural format. Score 1.0 for full compliance. Score 0.0 for complete non-compliance. Check element presence, ordering, and structure — not content quality. Respond ONLY with JSON: {"score": <number>, "reasoning": "<string>"}`;

export const SCHEMA_USER = (schema: string, input: string) =>
  `Required format: ${schema}\nText to evaluate: ${input}`;

export const FUZZY_SYSTEM = `You are a semantic similarity evaluator. Determine how semantically similar the candidate text is to the reference text. Score 1.0 for identical meaning (even with different wording). Score 0.0 for completely unrelated meaning. Ignore superficial differences in formatting, punctuation, or word choice when the meaning is preserved. Respond ONLY with JSON: {"score": <number>, "reasoning": "<string>"}`;

export const FUZZY_USER = (expected: string, input: string) =>
  `Reference text: ${expected}\nCandidate text: ${input}`;
