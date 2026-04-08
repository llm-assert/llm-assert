import { createProjectAction, type CreateProjectState } from "../actions";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they CANNOT reference top-level
// variables. All values must be inlined or use vi.hoisted().
// ---------------------------------------------------------------------------

const { mockGetUser, mockFrom, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/api-keys", () => ({
  generateApiKey: () => ({
    raw: "sk_test_raw_key",
    hash: "hash_abc",
    prefix: "sk_test",
  }),
}));

vi.mock("@/lib/slugify", () => ({
  validateSlug: (slug: string) =>
    /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(slug) ? null : "Invalid slug",
  nameToSlug: (name: string) =>
    name.toLowerCase().replace(/\s+/g, "-").slice(0, 64),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "user-uuid-test";

function makeFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("name", overrides?.name ?? "Test Project");
  fd.set("slug", overrides?.slug ?? "test-project");
  fd.set("description", overrides?.description ?? "");
  return fd;
}

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID } },
    error: null,
  });
}

function mockProjectCount(count: number) {
  // .from("projects").select("*", { count: "exact", head: true }).eq("user_id", ...)
  const projectChain = {
    eq: vi.fn().mockResolvedValue({ count, error: null }),
  };
  const projectSelect = vi.fn().mockReturnValue(projectChain);

  return { select: projectSelect, eq: projectChain.eq };
}

function mockSubscription(sub: { project_limit: number; plan: string } | null) {
  // .from("subscriptions").select("project_limit, plan").eq("user_id", ...).maybeSingle()
  const subChain = {
    maybeSingle: vi.fn().mockResolvedValue({ data: sub, error: null }),
  };
  const subEq = vi.fn().mockReturnValue(subChain);
  const subSelect = vi.fn().mockReturnValue({ eq: subEq });

  return { select: subSelect, eq: subEq, maybeSingle: subChain.maybeSingle };
}

function setupMocks(opts: {
  projectCount: number;
  subscription: { project_limit: number; plan: string } | null;
  rpcResult?: { status: string; project_id?: string; key_prefix?: string };
}) {
  mockAuthenticatedUser();

  const projectMock = mockProjectCount(opts.projectCount);
  const subMock = mockSubscription(opts.subscription);

  mockFrom.mockImplementation((table: string) => {
    if (table === "projects") {
      return { select: projectMock.select };
    }
    if (table === "subscriptions") {
      return { select: subMock.select };
    }
    return {};
  });

  if (opts.rpcResult) {
    mockRpc.mockResolvedValue({
      data: [opts.rpcResult],
      error: null,
    });
  }
}

const initialState: CreateProjectState = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createProjectAction", () => {
  describe("quota enforcement", () => {
    it("returns project_limit_reached when at quota (1 of 1)", async () => {
      setupMocks({
        projectCount: 1,
        subscription: { project_limit: 1, plan: "free" },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.error).toBe("project_limit_reached");
    });

    it("returns project_limit_reached when over quota (4 of 3)", async () => {
      setupMocks({
        projectCount: 4,
        subscription: { project_limit: 3, plan: "starter" },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.error).toBe("project_limit_reached");
    });

    it("allows creation under quota (2 of 3)", async () => {
      setupMocks({
        projectCount: 2,
        subscription: { project_limit: 3, plan: "starter" },
        rpcResult: {
          status: "ok",
          project_id: "proj-new-123",
          key_prefix: "sk_test",
        },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.success).toBe(true);
      expect(result.projectId).toBe("proj-new-123");
    });

    it("allows unlimited projects when limit is -1 (team plan)", async () => {
      setupMocks({
        projectCount: 50,
        subscription: { project_limit: -1, plan: "team" },
        rpcResult: {
          status: "ok",
          project_id: "proj-team-123",
          key_prefix: "sk_test",
        },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.success).toBe(true);
    });
  });

  describe("RPC status mapping", () => {
    it("maps RPC quota_exceeded to project_limit_reached", async () => {
      setupMocks({
        projectCount: 0,
        subscription: { project_limit: 1, plan: "free" },
        rpcResult: { status: "quota_exceeded" },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.error).toBe("project_limit_reached");
    });

    it("maps RPC no_subscription to unauthorized", async () => {
      setupMocks({
        projectCount: 0,
        subscription: { project_limit: 1, plan: "free" },
        rpcResult: { status: "no_subscription" },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.error).toBe("unauthorized");
    });

    it("maps RPC slug_taken to slug_taken", async () => {
      setupMocks({
        projectCount: 0,
        subscription: { project_limit: 3, plan: "starter" },
        rpcResult: { status: "slug_taken" },
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.error).toBe("slug_taken");
    });
  });

  describe("authentication", () => {
    it("returns unauthorized when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await createProjectAction(initialState, makeFormData());
      expect(result.error).toBe("unauthorized");
    });
  });
});
