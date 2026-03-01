import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SuperAdminProvider, useSuperAdminAuth } from "@/contexts/SuperAdminContext";
import Index from "./pages/Index";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Tenants from "./pages/Tenants";
import Finances from "./pages/Finances";
import Contracts from "./pages/Contracts";
import Maintenance from "./pages/Maintenance";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import BankIntegration from "./pages/BankIntegration";
import UsersPage from "./pages/Users";
import CalendarPage from "./pages/Calendar";
import Postfach from "./pages/Postfach";
import Anfragen from "./pages/Anfragen";
import Templates from "./pages/Templates";
import ImportPage from "./pages/Import";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import SuperAdminDashboard from "./pages/SuperAdmin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppLayout = () => (
  <SidebarProvider>
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bank" element={<BankIntegration />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/postfach" element={<Postfach />} />
        <Route path="/anfragen" element={<Anfragen />} />
        <Route path="/vorlagen" element={<Templates />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  </SidebarProvider>
);

function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSuperAdminAuth();
  if (!isAuthenticated) return <Navigate to="/superadmin/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SuperAdminProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/superadmin/login" element={<SuperAdminLogin />} />
              <Route
                path="/superadmin"
                element={
                  <SuperAdminGuard>
                    <SuperAdminDashboard />
                  </SuperAdminGuard>
                }
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </SuperAdminProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
