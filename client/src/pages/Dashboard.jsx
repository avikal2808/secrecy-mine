import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import CourseCard from '../components/CourseCard'
import DiscussionPanel from '../components/DiscussionPanel'
import { io } from 'socket.io-client'
import './Dashboard.css'

// Subject-specific video pools with real YouTube titles
const PHYSICS_VIDEOS = [
  { videoId: 'VVxDTH7Ywrk', title: 'Physics Marathon 2026 — Part 1', desc: 'Complete Physics Part 1 — One Shot by Rakshak Sir' },
  { videoId: 'euRS4IJ-V-0', title: 'Physics Marathon 2026 — Part 2', desc: 'Complete Physics Part 2 — One Shot by Rakshak Sir' },
  { videoId: 'V9vUxNVaqOw', title: 'Complete Physics — JEE 2026', desc: 'All Concepts & PYQs covered in one shot for JEE 2026' },
  { videoId: 'MCFrSja9aBI', title: 'Physics Final Exam Marathon', desc: 'All Chapters covered — Final Exam Marathon' },
  { videoId: '46CaYBwEp_k', title: 'Vectors — One Shot', desc: 'All Concepts, Tricks & PYQs on Vectors — Ummeed NEET' },
]

const CHEMISTRY_VIDEOS = [
  { videoId: 'axQXgnFREe8', title: 'Organic Chemistry — One Shot', desc: 'Complete Organic Chemistry — All Concepts & PYQs — JEE' },
  { videoId: '6WT8bzC8MmQ', title: 'Organic Chemistry — Marathon', desc: 'All Chapters of Organic Chemistry — One Shot' },
  { videoId: 'BB43j3fu1E4', title: 'Basic Concepts of Chemistry', desc: 'Chapter 1 — NCERT + Equations + PYQs' },
  { videoId: 'DuPGMwYrkaQ', title: 'Physical Chemistry — Marathon', desc: 'Complete Physical Chemistry — All Chapters — One Shot' },
  { videoId: 'pE_OfctVwnw', title: 'Chemistry Marathon 2026', desc: 'Complete Chemistry Revision by Aakash Sir' },
]

const MATHS_VIDEOS = [
  { videoId: '4LxrzD-MRBk', title: 'Statistics — One Shot', desc: 'Full Chapter — Chapter 13 — Class 11 Maths' },
  { videoId: 'kcSMOgFRp6w', title: 'Trigonometric Functions — One Shot', desc: 'Full Chapter — Chapter 3 — Class 11 Maths' },
  { videoId: 'CHWhaAlo_ms', title: 'Limits & Derivatives — One Shot', desc: 'Full Chapter — Chapter 12 — Class 11 Maths' },
  { videoId: '6I-EMg_z3XY', title: 'Basic Maths — JEE One Shot', desc: 'All Concepts & PYQs — Basic to Advanced' },
]

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function Dashboard({ user, onLogout }) {
  const [activeVideo, setActiveVideo] = useState(null)
  const [activeTitle, setActiveTitle] = useState('')
  const [streamActive, setStreamActive] = useState(false)
  const [chatUnlocked, setChatUnlocked] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)

  const isMini = user.id === 'u1'
  const isAvni = user.id === 'u2'

  // YouTube Search Effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const apiUrl = "http://localhost:3001"
        const res = await fetch(`${apiUrl}/api/youtube/search?q=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include'
        })
        const data = await res.json()
        if (data.results) {
          setSearchResults(data.results.map(v => ({
            title: v.title,
            description: 'YouTube Video',
            progress: Math.floor(Math.random() * 100),
            tag: 'YouTube',
            videoId: v.videoId,
            thumbnail: v.thumbnail
          })))
        }
      } catch (err) {
        console.error("Search error:", err)
      } finally {
        setSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Socket Initialization
  useEffect(() => {
    const socket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  // Easter egg: tap "Continue Learning" 5 times within 3s to reveal chat (Mini only)
  const handleEasterEgg = () => {
    if (!isMini || chatUnlocked) return
    tapCountRef.current += 1
    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0
      }, 3000)
    }
    if (tapCountRef.current >= 5) {
      clearTimeout(tapTimerRef.current)
      tapCountRef.current = 0
      setChatUnlocked(true)
    }
  }

  const courses = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults
    }

    const p = pickRandom(PHYSICS_VIDEOS)
    const c = pickRandom(CHEMISTRY_VIDEOS)
    const m = pickRandom(MATHS_VIDEOS)
    return [
      { icon: '', title: p.title, description: p.desc, progress: 72, tag: 'Popular', videoId: p.videoId },
      { icon: '', title: c.title, description: c.desc, progress: 45, tag: 'Trending', videoId: c.videoId },
      { icon: '', title: m.title, description: m.desc, progress: 33, tag: 'New', videoId: m.videoId },
    ]
  }, [searchQuery, searchResults]) // Added searchResults to dependency array

  const handlePlay = (videoId, title) => {
    setActiveVideo(videoId)
    setActiveTitle(title || 'Lecture')
    
    // Emit sync event if socket is ready
    if (socketRef.current) {
      socketRef.current.emit('video-selected', videoId)
    }
  }

  // Avni: request notification permission on mount
  useEffect(() => {
    if (isAvni && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isAvni])

  // Called by DiscussionPanel when a remote stream arrives
  const handleStreamChange = (stream) => {
    if (stream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream
      setStreamActive(true)
    } else {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      setStreamActive(false)
    }
  }

  const handlePanic = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      await fetch(`${apiUrl}/api/purge`, { method: 'POST', credentials: 'include' })
    } catch {}
    sessionStorage.removeItem('studyhub_user')
    onLogout()
    navigate('/')
  }

  // ===== AVNI'S DASHBOARD (no courses, big camera + chat) =====
  if (isAvni) {
    return (
      <div className="dashboard-page">
        <Navbar user={user} onLogout={onLogout} onSearch={setSearchQuery} />
        <main className="dashboard-content dashboard-content-avni">
          {/* Big camera feed area */}
          <section className="avni-camera-section">
            <div className="avni-camera-container">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="avni-camera-video"
              />
              {streamActive && <div className="avni-live-badge">LIVE</div>}
              {!streamActive && (
                <div className="avni-camera-placeholder">
                  <div className="avni-camera-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                  <p>Waiting for camera feed...</p>
                  <span>Feed will appear when Mini comes online</span>
                </div>
              )}
            </div>
          </section>

          {/* Discussion Section */}
          <section className="dashboard-discussion-section" id="dashboard-discussion">
            <DiscussionPanel
              user={user}
              socket={socketRef.current}
              onPanic={null}
              onStreamChange={handleStreamChange}
              onLogout={onLogout}
            />
          </section>
        </main>
      </div>
    )
  }

  // ===== EVERYONE ELSE'S DASHBOARD (courses + chat) =====
  return (
    <div className="dashboard-page">
      <Navbar user={user} onLogout={onLogout} onSearch={setSearchQuery} />
      <main className="dashboard-content">
        {!searchQuery && (
          <section className="dashboard-welcome">
            <h1 className="dashboard-greeting">
              Welcome back, <span className="dashboard-name">{user.displayName}</span>
            </h1>
            <p className="dashboard-sub">Continue where you left off</p>
          </section>
        )}

        <section className="dashboard-courses" id="dashboard-courses">
          <div className="dashboard-section-header">
            <h2
              className="dashboard-section-title"
              onClick={handleEasterEgg}
              style={isMini ? { userSelect: 'none', WebkitUserSelect: 'none' } : undefined}
            >
              {searching ? 'Searching YouTube...' : (searchQuery ? `Search Results for "${searchQuery}"` : 'Continue Learning')}
            </h2>
            <p className="dashboard-section-subtitle">
              {searching ? 'Fetching real-time videos from YouTube' : (searchQuery ? `Found ${courses.length} videos matching your search` : 'Pick up from where you left off')}
            </p>
          </div>
          {courses.length > 0 ? (
            <div className={searchQuery ? "dashboard-courses-grid" : "dashboard-courses-scroll"}>
              {courses.map((course, i) => (
                <CourseCard
                  key={i}
                  {...course}
                  onPlay={(vid) => handlePlay(vid, course.title)}
                />
              ))}
            </div>
          ) : (
            <div className="dashboard-no-results">
              <p>No videos found matching your search.</p>
            </div>
          )}
        </section>

        {/* PiP YouTube video */}
        {activeVideo && (
          <div className="dashboard-pip-video">
            <div className="dashboard-pip-header">
              <span className="dashboard-pip-label">Now Playing: {activeTitle}</span>
              <button className="dashboard-pip-close" onClick={() => setActiveVideo(null)}>x</button>
            </div>
            <div className="dashboard-pip-wrapper">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1&rel=0`}
                title="Lecture Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="dashboard-pip-iframe"
              />
            </div>
          </div>
        )}

        {/* Discussion Section — hidden behind easter egg for Mini */}
        {(!isMini || chatUnlocked) && (
          <section className={`dashboard-discussion-section ${isMini && chatUnlocked ? 'chat-reveal' : ''}`} id="dashboard-discussion">
            <DiscussionPanel
              user={user}
              socket={socketRef.current}
              onPanic={handlePanic}
              onLogout={onLogout}
            />
          </section>
        )}
      </main>
    </div>
  )
}

export default Dashboard
