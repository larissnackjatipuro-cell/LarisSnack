import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LapakProvider } from './context/LapakContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Titipan from './pages/Titipan'
import POS from './pages/POS'
import TutupHari from './pages/TutupHari'
import Pembayaran from './pages/Pembayaran'
import Laporan from './pages/Laporan'
import MasterData from './pages/MasterData'
import TitipanSaya from './pages/TitipanSaya'

function Protected({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <LapakProvider>
        <Layout>{children}</Layout>
      </LapakProvider>
    </ProtectedRoute>
  )
}

// "/" tidak terikat satu role — arahkan ke halaman yang sesuai supaya
// produsen tidak melihat Dashboard staf (dan sebaliknya).
function Home() {
  const { profile } = useAuth()
  if (!profile) return null
  if (profile.role === 'produsen') return <Navigate to="/titipan-saya" replace />
  return <Dashboard />
}

const STAFF = ['admin', 'kasir']

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/titipan" element={<Protected allowedRoles={STAFF}><Titipan /></Protected>} />
          <Route path="/pos" element={<Protected allowedRoles={STAFF}><POS /></Protected>} />
          <Route path="/tutup-hari" element={<Protected allowedRoles={STAFF}><TutupHari /></Protected>} />
          <Route path="/pembayaran" element={<Protected allowedRoles={STAFF}><Pembayaran /></Protected>} />
          <Route path="/laporan" element={<Protected allowedRoles={STAFF}><Laporan /></Protected>} />
          <Route path="/master-data" element={<Protected allowedRoles={STAFF}><MasterData /></Protected>} />
          <Route path="/titipan-saya" element={<Protected allowedRoles={['produsen']}><TitipanSaya /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
