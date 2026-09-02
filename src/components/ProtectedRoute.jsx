import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { firebaseUser, profile, loading } = useAuth()

  if (loading) return <div style={{ padding: 40 }}>Memuat...</div>
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') {
    return <div style={{ padding: 40 }}>Anda tidak punya akses ke halaman ini.</div>
  }
  return children
}
