import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BundlesList } from "@/components/bundles/bundles-list";
import { getUser } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { BUNDLE_SUMMARY_SELECT, type BundleSummary } from "@/types/database";

export const metadata = {
  title: "My Bundles",
  description: "View and manage your saved icon bundles",
};

export default async function BundlesPage() {
  const user = await getUser();

  if (!user) {
    redirect("/?login=required");
  }

  const supabase = await createClient();
  const { data: bundles, error: bundlesError } = await supabase
    .from("bundles")
    .select(BUNDLE_SUMMARY_SELECT)
    .eq("user_id", user.profile.id)
    .order("created_at", { ascending: false });

  if (bundlesError) {
    throw bundlesError;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 px-4 lg:px-20 xl:px-40 py-8">
        <div className="max-w-6xl mx-auto">
          <BundlesList initialBundles={(bundles ?? []) as unknown as BundleSummary[]} />
        </div>
      </div>
    </div>
  );
}
