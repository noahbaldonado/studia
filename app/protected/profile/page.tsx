import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { MyMaterial } from "@/components/my-material";

export default async function UserProfilePage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return redirect("/");
  }
  const displayName = user.user_metadata?.full_name;

  // Hardcoded rating (out of 10)
  const userRating = 7.5;

  return (
    <div className="px-4 py-6 pb-24">
      <header className="flex justify-between items-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">{displayName || "Profile"}</h1>
        <LogoutButton />
      </header>

      {/* User Rating Section */}
      <section className="mb-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-zinc-900">
            {userRating.toFixed(1)}
            <span className="text-xl font-normal text-zinc-500">/10</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < Math.round(userRating)
                      ? "bg-blue-600"
                      : "bg-zinc-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-1">User Rating</p>
          </div>
        </div>
      </section>

      {/* My Material Section */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-4">My Material</h2>
        <MyMaterial userId={user.id} />
      </section>
    </div>
  );
}
