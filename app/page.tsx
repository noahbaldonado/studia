import { GoogleSignInButton } from "@/components/sign-in-google-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return redirect("/protected");
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-white via-blue-50 to-blue-100 text-blue-900" style={{ height: '100vh', maxHeight: '844px', width: '100vw', maxWidth: '390px', margin: '0 auto' }}>
      {/* Logo and Name at the top */}
      <div className="flex flex-col items-center pt-20 px-6">
        {/* Logo - Blue Open Book */}
        <div className="flex items-center justify-center">
          <BookOpen className="h-20 w-20 text-blue-600" strokeWidth={1.5} />
        </div>
        
        {/* App Name */}
        <h1 className="text-4xl font-bold text-blue-900 tracking-tight mt-3">Studia</h1>
      </div>
      
      {/* Sign In Button - positioned with balanced spacing */}
      <div className="flex items-center justify-center px-6 pb-8 mt-40">
        <GoogleSignInButton />
      </div>
    </main>
  );
}