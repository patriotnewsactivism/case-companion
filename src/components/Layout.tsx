import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  FolderOpen,
  Calendar,
  BookOpen,
  Gavel,
  Settings,
  LogOut,
  Menu,
  X,
  Scale,
  Search,
  Cloud,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/cases", label: "My Cases", icon: FolderOpen },
  { path: "/trial-prep", label: "Trial Prep", icon: Gavel },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/research", label: "Legal Research", icon: BookOpen },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/login");
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return "U";
    const parts = user.email.split("@")[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 p-1 flex items-center justify-center">
            <Scale className="h-full w-full text-primary" />
          </div>
          <span className="font-serif font-bold text-primary">CaseBuddy</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Desktop header */}
      <header className="fixed top-0 left-64 right-0 z-40 hidden lg:flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-6">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <Cloud className="h-4 w-4" />
            <span>Saved</span>
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          </Button>
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
            {getUserInitials()}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center px-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sidebar-primary/20 p-1.5 flex items-center justify-center">
                <Scale className="h-full w-full text-sidebar-primary" />
              </div>
              <div>
                <p className="font-serif font-bold text-sidebar-foreground text-lg">
                  CaseBuddy
                </p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-sidebar-foreground/60">
                  Legal AI OS
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-4">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pt-16">{children}</div>
      </main>
    </div>
  );
}