import { createClient } from "@supabase/supabase-js";

export default async function globalTeardown() {
  const email = process.env.E2E_TEST_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !supabaseUrl || !serviceRoleKey) {
    // Env vars missing — nothing to clean up
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: listData } = await admin.auth.admin.listUsers();
  const testUser = listData?.users.find((u) => u.email === email);

  if (testUser) {
    await admin.auth.admin.deleteUser(testUser.id);
  }
}
