export function SitePageShell({
  children,
}: {
  currentPath?: string;
  children: React.ReactNode;
}) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>;
}
