"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <Button 
      onClick={logout} 
      className="p-2 bg-white border border-blue-200 hover:bg-blue-50" 
      aria-label="Logout"
    >
      <LogOut className="h-5 w-5 text-blue-600" />
    </Button>
  );
}
