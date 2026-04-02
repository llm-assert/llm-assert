const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MAX_SLUG_LENGTH = 64;

export function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (slug.length > MAX_SLUG_LENGTH)
    return `Slug must be ${MAX_SLUG_LENGTH} characters or fewer`;
  if (!SLUG_PATTERN.test(slug))
    return "Slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen";
  return null;
}

export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}
