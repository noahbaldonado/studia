import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  let error = params.error || "Unknown error";
  
  // Clean up error message to remove any Supabase URLs that might have leaked through
  error = error.replace(/https?:\/\/[^\s]+\.supabase\.co[^\s]*/g, "");
  error = error.trim() || "Authentication failed. Please try again.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-black">
      <div className="flex flex-col items-center gap-4 p-8 max-w-md">
        <h1 className="text-2xl font-bold text-red-600">Authentication Error</h1>
        <p className="text-center text-zinc-600">{error}</p>
        <Link
          href="/"
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
