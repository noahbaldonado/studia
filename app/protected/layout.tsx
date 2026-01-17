import { BottomNav } from "@/components/bottom-nav";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col pb-20">
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
