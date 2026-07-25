import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { NavBar } from './components/NavBar'
import { OfflineBanner } from './components/OfflineBanner'
import { Login } from './pages/Login'
import { Restablecer } from './pages/Restablecer'
import { Terminos } from './pages/Terminos'
import { Privacidad } from './pages/Privacidad'
import { Scanner } from './pages/Scanner'
import { MaterialForm } from './pages/MaterialForm'
import { Listado } from './pages/Listado'
import { Dashboard } from './pages/Dashboard'
import { Almacenes } from './pages/Almacenes'
import { Categorias } from './pages/Categorias'
import { Estadisticas } from './pages/Estadisticas'
import { isSupabaseConfigured } from './lib/supabase'

function SetupNeeded() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Falta configurar Supabase</h1>
        <p className="auth-subtitle">
          Copia <code>.env.example</code> a <code>.env</code>, pega tu URL y anon key de Supabase (Project
          Settings → API) y reinicia <code>npm run dev</code>. Revisa el README para el paso a paso completo.
        </p>
      </div>
    </div>
  )
}

function AppShell() {
  const { pathname } = useLocation()

  return (
    <>
      <OfflineBanner />
      <NavBar />
      <main className="app-main">
        <div className="page-enter" key={pathname}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/restablecer" element={<Restablecer />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scanner"
              element={
                <ProtectedRoute>
                  <Scanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/material/:codigo"
              element={
                <ProtectedRoute>
                  <MaterialForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listado"
              element={
                <ProtectedRoute>
                  <Listado />
                </ProtectedRoute>
              }
            />
            <Route
              path="/almacenes"
              element={
                <ProtectedRoute>
                  <Almacenes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/categorias"
              element={
                <ProtectedRoute>
                  <Categorias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estadisticas"
              element={
                <ProtectedRoute>
                  <Estadisticas />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
