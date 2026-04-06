import { Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Documents from "@/pages/Documents";
import SignDocument from "@/pages/SignDocument";
import UploadDocument from "@/pages/UploadDocument";
import Tickets from "@/pages/Tickets";
import NewTicket from "@/pages/NewTicket";
import Finances from "@/pages/Finances";
import Messages from "@/pages/Messages";

/**
 * Wraps all slug-scoped routes with branding + auth providers.
 * The slug param is available because this component is rendered
 * inside a Route with ":slug" in the path.
 */
function SlugApp() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;

  return (
    <BrandingProvider slug={slug}>
      <AuthProvider slug={slug}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="invite/:token" element={<AcceptInvite />} />

          <Route element={
            <ProtectedRoute>
              <Layout>
                <Outlet />
              </Layout>
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents/:documentId/sign" element={<SignDocument />} />
            <Route path="documents/upload" element={<UploadDocument />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="tickets/new" element={<NewTicket />} />
            <Route path="finances" element={<Finances />} />
            <Route path="messages" element={<Messages />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrandingProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/:slug/*" element={<SlugApp />} />
      <Route path="*" element={<div className="flex items-center justify-center min-h-screen text-gray-500">Portal nicht gefunden.</div>} />
    </Routes>
  );
}
