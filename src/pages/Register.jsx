import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerWithInviteCode } from '../lib/domain'

export default function Register() {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return }
    setBusy(true)
    try {
      await registerWithInviteCode({ name, email, password, code })
      await refreshProfile()
      navigate('/')
    } catch (err) {
      setError(translateError(err))
    } finally {
      setBusy(false)
    }
  }

  function translateError(err) {
    if (err.code === 'auth/email-already-in-use') return 'Email ini sudah terdaftar. Coba login, atau pakai email lain.'
    if (err.code === 'auth/weak-password') return 'Password terlalu lemah, minimal 6 karakter.'
    if (err.code === 'auth/invalid-email') return 'Format email tidak valid.'
    return err.message || 'Registrasi gagal. Coba lagi.'
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Daftar Akun</h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Khusus untuk kasir & produsen yang sudah punya kode undangan dari admin lapak.
        </p>
        {error && <div className="error-text">{error}</div>}
        <label>Nama Lengkap</label>
        <input value={name} onChange={e => setName(e.target.value)} required />
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        <label>Kode Undangan</label>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Contoh: 7K9XQ2MP"
          style={{ textTransform: 'uppercase', letterSpacing: 1 }}
          required
        />
        <p className="help-text" style={{ marginTop: -8 }}>
          Minta kode ini ke admin lapak Anda (dibuat dari menu Master Data).
        </p>
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Mendaftarkan...' : 'Daftar'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}>
          Sudah punya akun? <Link to="/login">Masuk di sini</Link>
        </p>
      </form>
    </div>
  )
}
