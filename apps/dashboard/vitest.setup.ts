import "@testing-library/jest-dom/vitest";

// Mock `server-only` — prevents "This module cannot be imported from a Client
// Component module" errors when components transitively import server modules.
vi.mock("server-only", () => ({}));

// Mock `next/navigation` — provides spies for client-side navigation hooks.
// Individual tests can override via vi.mocked(useRouter).mockReturnValue({...}).
vi.mock("next/navigation", () => {
  // Mirror ReadonlyURLSearchParams (useSearchParams returns read-only in Next.js)
  const readonlySearchParams = new URLSearchParams();
  Object.freeze(readonlySearchParams);

  return {
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    })),
    usePathname: vi.fn(() => "/"),
    useSearchParams: vi.fn(() => readonlySearchParams),
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
});

// Mock `next/headers` — Next.js 16 async APIs.
// cookies() and headers() return promises.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(() => false),
  })),
  headers: vi.fn(async () => ({
    get: vi.fn(() => null),
    getAll: vi.fn(() => []),
    has: vi.fn(() => false),
    entries: vi.fn(() => [][Symbol.iterator]()),
    keys: vi.fn(() => [][Symbol.iterator]()),
    values: vi.fn(() => [][Symbol.iterator]()),
    forEach: vi.fn(),
  })),
}));
