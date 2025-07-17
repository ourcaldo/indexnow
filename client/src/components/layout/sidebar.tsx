import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { 
  Search, 
  Home, 
  Zap, 
  Briefcase, 
  Settings, 
  Menu,
  LogOut,
  User
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "IndexNow", href: "/dashboard/indexnow", icon: Zap },
  { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 bg-black/50 lg:hidden z-40" />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full bg-white shadow-lg sidebar-transition z-50",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-orange-500 rounded-lg flex items-center justify-center">
                <Search className="h-4 w-4 text-white" />
              </div>
              {!collapsed && (
                <h1 className="text-xl font-bold text-slate-800">IndexNow Pro</h1>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || 
              (item.href !== "/dashboard" && location.startsWith(item.href));
            
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                    collapsed ? "justify-center" : "",
                    isActive
                      ? "bg-primary/10 text-primary border-l-4 border-primary"
                      : "text-slate-600 hover:bg-gray-50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {!collapsed && (
                    <span className="font-medium">{item.name}</span>
                  )}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className={cn(
            "flex items-center space-x-3 px-4 py-3",
            collapsed ? "justify-center" : ""
          )}>
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">
                  {user?.user_metadata?.full_name || user?.email}
                </div>
                <div className="text-xs text-slate-500">
                  {user?.email}
                </div>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="p-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
