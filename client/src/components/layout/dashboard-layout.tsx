import Sidebar from "./sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-warm-100">
      <Sidebar />
      <div className="lg:pl-64">
        {children}
      </div>
    </div>
  );
}
