import { GoogleSignInButton } from "@/components/sign-in-google-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return redirect("/protected");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-black">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Benvenuto</h1>
        <GoogleSignInButton />
      </div>
    </main>
  );
}