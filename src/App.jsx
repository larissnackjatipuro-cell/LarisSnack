import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LapakProvider } from './context/LapakContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Titipan from './pages/Titipan'
import POS from './pages/POS'
import TutupHari from './pages/TutupHari'
import Pembayaran from './pages/Pembayaran'
import Laporan from './pages/Laporan'
import MasterData from './pages/MasterData'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <LapakProvider>
        <Layout>{children}</Layout>
      </LapakProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/titipan" element={<Protected><Titipan /></Protected>} />
          <Route path="/pos" element={<Protected><POS /></Protected>} />
          <Route path="/tutup-hari" element={<Protected><TutupHari /></Protected>} />
          <Route path="/pembayaran" element={<Protected><Pembayaran /></Protected>} />
          <Route path="/laporan" element={<Protected><Laporan /></Protected>} />
          <Route path="/master-data" element={<Protected><MasterData /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
