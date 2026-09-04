import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // dokumen di koleksi 'users': { name, role, lapakIds }
  const [loading, setLoading] = useState(true)

  async function loadProfile(user) {
    const snap = await getDoc(doc(db, 'users', user.uid))
    setProfile(snap.exists() ? snap.data() : { name: user.email, role: 'kasir', lapakIds: [] })
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        await loadProfile(user)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  // Dipanggil manual setelah registrasi mandiri (lihat Register.jsx) —
  // supaya profil ter-refresh SETELAH dokumen users/{uid} selesai ditulis,
  // bukan mengandalkan onAuthStateChanged yang bisa fire lebih dulu sebelum
  // dokumen itu ada (race condition yang bikin role salah kebaca 'kasir'
  // default padahal seharusnya 'produsen').
  async function refreshProfile() {
    if (auth.currentUser) await loadProfile(auth.currentUser)
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
