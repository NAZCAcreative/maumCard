import BottomNav from "@/components/layout/BottomNav";
import ThemeSettings from "@/components/layout/ThemeSettings";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full pb-36 sm:pb-32">
      {children}
      <ThemeSettings />
      <BottomNav />
    </div>
  );
}
