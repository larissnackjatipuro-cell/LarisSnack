import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// allowedRoles: array opsional, misal ['admin','kasir'] atau ['produsen'].
// Kalau tidak diisi, cukup butuh login (dipakai untuk halaman seperti Home
// yang menentukan sendiri routing internal berdasarkan role).
export default function ProtectedRoute({ children, allowedRoles }) {
  const { firebaseUser, profile, loading } = useAuth()

  if (loading) return <div style={{ padding: 40 }}>Memuat...</div>
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <div style={{ padding: 40 }}>Anda tidak punya akses ke halaman ini.</div>
  }
  return children
}
