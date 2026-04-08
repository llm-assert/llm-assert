import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// server-only is a build-time guard — stub it out in tests
vi.mock("server-only", () => ({}));

// React.cache is a no-op wrapper in test context — pass through the fn
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: (fn: unknown) => fn,
  };
});

// ---------------------------------------------------------------------------
// SUT — import AFTER mocks are set up
// ---------------------------------------------------------------------------

// Re-import fresh module for each test to avoid React.cache dedup
async function loadModule() {
  const mod = await import("@/lib/queries/get-auth-user");
  return mod;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("getAuthUser", () => {
  it("returns user when authenticated", async () => {
    const fakeUser = { id: "user-1", email: "test@example.com" };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { getAuthUser } = await loadModule();
    const user = await getAuthUser();

    expect(user).toEqual(fakeUser);
    expect(mockGetUser).toHaveBeenCalledOnce();
  });

  it("returns null when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { getAuthUser } = await loadModule();
    const user = await getAuthUser();

    expect(user).toBeNull();
  });
});

describe("requireAuth", () => {
  it("returns user when authenticated", async () => {
    const fakeUser = { id: "user-1", email: "test@example.com" };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { requireAuth } = await loadModule();
    const user = await requireAuth();

    expect(user).toEqual(fakeUser);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("calls redirect when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { requireAuth } = await loadModule();
    await requireAuth();

    expect(mockRedirect).toHaveBeenCalledWith("/sign-in");
  });
});
