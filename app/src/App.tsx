// App.tsx
// Root component. Wraps the app in context providers and defines
// the full React Router v6 route tree.
//
// Route structure:
//   /login          — public
//   /register       — public
//   /               — redirects to /dashboard
//   /* (protected)  — requires auth, renders inside AppLayout
//      /dashboard
//      /devices
//      /telemetry
//      /predictions
//      /anomalies
//      /export
//      /notifications
//      /profile

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Telemetry from './pages/Telemetry';
import Predictions from './pages/Predictions';
import Anomalies from './pages/Anomalies';
import Export from './pages/Export';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              {/* ── Public routes ──────────────────────────── */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* ── Root redirect ──────────────────────────── */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* ── Protected routes ───────────────────────── */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/telemetry" element={<Telemetry />} />
                  <Route path="/predictions" element={<Predictions />} />
                  <Route path="/anomalies" element={<Anomalies />} />
                  <Route path="/export" element={<Export />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
              </Route>

              {/* ── 404 fallback ───────────────────────────── */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}