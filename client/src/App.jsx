import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import './App.css'

function App() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('studyhub_user')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    // Verify session on mount
    const apiUrl = "http://localhost:3001"
    fetch(`${apiUrl}/api/status`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user)
          sessionStorage.setItem('studyhub_user', JSON.stringify(data.user))
        } else {
          setUser(null)
          sessionStorage.removeItem('studyhub_user')
        }
      })
      .catch(() => {})
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    sessionStorage.setItem('studyhub_user', JSON.stringify(userData))
  }

  const handleLogout = async () => {
    const apiUrl = "http://localhost:3001"
    await fetch(`${apiUrl}/api/reset`, { method: 'POST', credentials: 'include' })
    setUser(null)
    sessionStorage.removeItem('studyhub_user')
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/dashboard" element={
          user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
