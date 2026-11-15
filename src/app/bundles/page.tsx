import { redirect } from "next/navigation";
import Link from "next/link";
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
    .order("updated_at", { ascending: false });

  if (bundlesError) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <h1 className="text-xl font-medium text-foreground">Unable to load bundles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your bundles could not be retrieved. Please try again.
          </p>
          <Link
            href="/bundles"
            className="mt-4 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Try again
          </Link>
        </div>
      </div>
    );
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
