import { useState } from "react";
import Sidebar from "./sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-warm-100">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onCollapsedChange={setSidebarCollapsed} 
      />
      <div className={`transition-all duration-300 ${
        isMobile 
          ? "pl-0 pt-16" // Mobile: no padding left, add top padding for mobile menu button
          : sidebarCollapsed 
            ? "pl-20" 
            : "pl-64"
      }`}>
        {children}
      </div>
    </div>
  );
}
