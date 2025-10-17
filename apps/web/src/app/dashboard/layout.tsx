'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Calendar,
  FileCheck,
  FileText,
  LogOut,
  Search,
  Settings,
  Shield,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { isAuthenticated, logout } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { ThemeToggle } from '@/components/ThemeToggle';
import OrgBadge from '@/components/OrgBadge';

// Base navigation items
const baseNavigation = [
  { name: 'Incidents', href: '/dashboard/incidents', icon: AlertTriangle },
  { name: 'Tips', href: '/dashboard/tips', icon: FileText },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
  { name: 'Events', href: '/dashboard/events', icon: Calendar },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// Feature-flagged navigation items
const featureNavigation = {
  evidence: { name: 'Evidence', href: '/dashboard/evidence/list', icon: FileCheck, feature: 'EVIDENCE' as const },
};

// Build navigation array based on enabled features
function getNavigation() {
  const nav = [...baseNavigation];
  
  // Insert evidence link before Settings if enabled
  if (isFeatureEnabled('EVIDENCE')) {
    nav.splice(-1, 0, featureNavigation.evidence);
  }
  
  return nav;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = getNavigation();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = async () => {
    await logout();
    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully',
    });
    router.push('/login');
  };

  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="hidden w-64 flex-col border-r bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Shomer</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative w-64 lg:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Search incidents, tips..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OrgBadge />
            <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Avatar>
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-[calc(100vh-4rem-5rem)] p-4 lg:p-6">{children}</div>
          <footer className="border-t bg-white px-4 py-3 text-center text-xs text-slate-500 lg:px-6">
            <p>
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              {' • '}
              <Link href="/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
              {' • '}
              © {new Date().getFullYear()} Shomer
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

