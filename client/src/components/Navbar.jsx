import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Navbar.css'

function Navbar({ user, onLogout, onSearch }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleLogout = () => {
    setMenuOpen(false)
    onLogout()
    navigate('/')
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(searchQuery)
    }
  }

  const handleSearchChange = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    if (onSearch) {
      onSearch(query)
    }
  }

  return (
    <nav className="navbar" id="main-navbar">
      <Link to="/" className="navbar-brand">
        <span className="navbar-title">Physics<span className="navbar-title-accent">Wallah</span></span>
      </Link>
      
      <div className="navbar-search">
        <form onSubmit={handleSearchSubmit} className="navbar-search-form">
          <svg className="navbar-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="navbar-search-input"
            placeholder="Search for videos..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </form>
      </div>

      <div className="navbar-actions">
        {user ? (
          <div className="navbar-user">
            <button
              className="navbar-avatar"
              onClick={() => setMenuOpen(!menuOpen)}
              id="user-menu-btn"
              aria-label="User menu"
            >
              {user.displayName[0]}
            </button>
            {menuOpen && (
              <>
                <div className="navbar-menu-overlay" onClick={() => setMenuOpen(false)} />
                <div className="navbar-menu" id="user-dropdown">
                  <div className="navbar-menu-header">
                    <span className="navbar-menu-name">{user.displayName}</span>
                    <span className="navbar-menu-role">Class 11 | Student</span>
                  </div>
                  <div className="navbar-menu-divider" />
                  <button className="navbar-menu-item" onClick={() => { setMenuOpen(false); navigate('/dashboard') }}>
                    Dashboard
                  </button>
                  <button className="navbar-menu-item" onClick={() => { setMenuOpen(false); navigate('/') }}>
                    Home
                  </button>
                  {onLogout && (
                    <>
                      <div className="navbar-menu-divider" />
                      <button className="navbar-menu-item navbar-menu-logout" onClick={handleLogout} id="logout-btn">
                        Sign Out
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <Link to="/login" className="navbar-login-btn" id="login-btn">
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}

export default Navbar
