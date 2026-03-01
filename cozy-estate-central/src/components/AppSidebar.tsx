import {
  Building2,
  Users,
  FileText,
  Wrench,
  BarChart3,
  Settings,
  LayoutDashboard,
  CreditCard,
  Bell,
  LogOut,
  Landmark,
  Shield,
  CalendarDays,
  Mail,
  Inbox,
  LayoutTemplate,
  Scale,
  FileInput,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Immobilien", url: "/properties", icon: Building2 },
  { title: "Mieter", url: "/tenants", icon: Users },
  { title: "Verträge", url: "/contracts", icon: FileText },
  { title: "Finanzen", url: "/finances", icon: CreditCard },
  { title: "Bankanbindung", url: "/bank", icon: Landmark },
];

const secondaryNav = [
  { title: "Wartung", url: "/maintenance", icon: Wrench },
  { title: "Vorlagen", url: "/vorlagen", icon: LayoutTemplate },
  { title: "Datenimport", url: "/import", icon: FileInput },
  { title: "Berichte", url: "/reports", icon: BarChart3 },
  { title: "Benachrichtigungen", url: "/notifications", icon: Bell },
];

const kommunikationNav = [
  { title: "Kalender", url: "/calendar", icon: CalendarDays },
  { title: "Postfach", url: "/postfach", icon: Mail },
  { title: "Anfragen", url: "/anfragen", icon: Inbox },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const collapsed = state === "collapsed";
  const isAdmin = user?.role === "ADMIN";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-heading text-sm font-bold text-sidebar-foreground">
              ImmoVerwalt
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              Immobilienverwaltung
            </span>
          </div>
        )}
      </div>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Übersicht
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Verwaltung
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Administration">
                    <NavLink
                      to="/administration"
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Administration</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Kommunikation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {kommunikationNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Einstellungen">
              <NavLink
                to="/settings"
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <Settings className="h-4 w-4" />
                <span>Einstellungen</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
              Rechtliches
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Impressum">
              <NavLink
                to="/impressum"
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Impressum</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Datenschutz">
              <NavLink
                to="/datenschutz"
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Datenschutz</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Abmelden"
              onClick={logout}
              className="text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
