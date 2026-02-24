import { AppNavbar } from "@/components/app-navbar";

export async function SitePageShell({
  currentPath,
  searchQuery,
  children,
}: {
  currentPath: string;
  searchQuery?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-100 to-amber-50/80 text-zinc-900">
      <AppNavbar currentPath={currentPath} searchQuery={searchQuery} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
