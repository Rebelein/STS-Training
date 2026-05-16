import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider, useAuth } from "./components/auth-provider";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { UpdateNotification } from "./components/UpdateNotification";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Lade...</div>;
  }
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Lade...</div>;
  }
  
  if (session) {
    return <Navigate to="/app" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sts-wachendorf-theme">
      <AuthProvider>
        <UpdateNotification />
        <PWAInstallBanner />
        <Router>
          <Routes>
            <Route path="/" element={
              <PublicRoute>
                <LandingPage />
              </PublicRoute>
            } />
            <Route path="/login" element={
              <PublicRoute>
                <AuthPage mode="login" />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <AuthPage mode="register" />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <AuthPage mode="forgot_password" />
              </PublicRoute>
            } />
            <Route path="/update-password" element={
              <AuthPage mode="update_password" />
            } />
            
            <Route path="/app/*" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

