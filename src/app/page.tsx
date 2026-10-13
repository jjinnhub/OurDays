import { redirect } from "next/navigation";

import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export default async function Home() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }
  redirect("/login");
}
