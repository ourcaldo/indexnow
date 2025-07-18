import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Home, 
  Zap, 
  Briefcase, 
  Settings, 
  Menu,
  LogOut,
  User,
  X,
  Plus,
  ChevronDown,
  ChevronRight
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { 
    name: "IndexNow", 
    icon: Zap, 
    children: [
      { name: "New Index", href: "/dashboard/indexnow", icon: Plus },
      { name: "Manage Jobs", href: "/dashboard/jobs", icon: Briefcase }
    ]
  },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  children?: NavigationItem[];
}

export default function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['IndexNow']);

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (item.href) {
      return location === item.href || 
        (item.href !== "/dashboard" && location.startsWith(item.href));
    }
    
    if (item.children) {
      return item.children.some(child => 
        location === child.href || 
        (child.href !== "/dashboard" && location.startsWith(child.href!))
      );
    }
    
    return false;
  };

  const renderNavigationItem = (item: NavigationItem, depth = 0) => {
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.includes(item.name);
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpanded(item.name)}
            className={cn(
              "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors text-left",
              collapsed ? "justify-center" : "",
              isActive
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="h-5 w-5" />
              {!collapsed && (
                <span className="font-medium">{item.name}</span>
              )}
            </div>
            {!collapsed && (
              isExpanded ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {!collapsed && isExpanded && (
            <div className="ml-6 mt-1 space-y-1">
              {item.children.map(child => renderNavigationItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link key={item.name} href={item.href!}>
        <a
          className={cn(
            "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
            collapsed ? "justify-center" : "",
            depth > 0 ? "text-sm" : "",
            isActive
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          <item.icon className="h-5 w-5" />
          {!collapsed && (
            <span className="font-medium">{item.name}</span>
          )}
        </a>
      </Link>
    );
  };

  if (isMobile) {
    return (
      <>
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed top-4 left-4 z-50 md:hidden p-2"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={cn(
            "fixed left-0 top-0 h-full bg-white shadow-lg sidebar-transition z-50 md:hidden",
            mobileMenuOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"
          )}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">pulse</h1>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              if (item.children) {
                const isActive = isItemActive(item);
                const isExpanded = expandedItems.includes(item.name);
                
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors text-left",
                        isActive
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {isExpanded ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />}
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map(child => (
                          <Link key={child.name} href={child.href}>
                            <a
                              className={cn(
                                "flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm",
                                (location === child.href || location.startsWith(child.href!))
                                  ? "bg-slate-100 text-slate-900"
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <child.icon className="h-4 w-4" />
                              <span className="font-medium">{child.name}</span>
                            </a>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              
              const isActive = location === item.href || 
                (item.href !== "/dashboard" && location.startsWith(item.href!));
              
              return (
                <Link key={item.name} href={item.href!}>
                  <a
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                      isActive
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 px-4 py-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">
                  {user?.user_metadata?.full_name || user?.email}
                </div>
                <div className="text-xs text-slate-500">
                  {user?.email}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="p-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full bg-white shadow-lg sidebar-transition z-50 hidden md:block",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-between"
          )}>
            <div className={cn(
              "flex items-center",
              collapsed ? "justify-center" : ""
            )}>
              {!collapsed && (
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">pulse</h1>
              )}
              {collapsed && (
                <h1 className="text-lg font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">P</h1>
              )}
            </div>
            {!collapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCollapsedChange(!collapsed)}
                className="p-2"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
          </div>
          {collapsed && (
            <div className="flex justify-center mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCollapsedChange(!collapsed)}
                className="p-2"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navigation.map((item) => renderNavigationItem(item))}
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
