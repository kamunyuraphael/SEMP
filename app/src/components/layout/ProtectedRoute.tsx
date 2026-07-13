// components/layout/ProtectedRoute.tsx
// Wraps private routes, redirecting unauthenticated users to /login
// and showing a loading state while AuthContext rehydrates from
// localStorage on initial app load.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // While AuthContext is checking localStorage for an existing session,
  // render a full-page spinner rather than briefly flashing the login page.
  if (isLoading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the attempted location so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
