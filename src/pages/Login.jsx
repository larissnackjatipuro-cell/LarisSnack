import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError('Email atau password salah.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Masuk</h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Aplikasi Aktivitas Harian — Manajemen Titipan Lapak
        </p>
        {error && <div className="error-text">{error}</div>}
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Memproses...' : 'Masuk'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}>
          Punya kode undangan dari admin? <Link to="/register">Daftar di sini</Link>
        </p>
      </form>
    </div>
  )
}
