import { useState, useMemo, useEffect } from 'react'
import Navbar from '../components/Navbar'
import CourseCard from '../components/CourseCard'
import './Home.css'

// Subject-specific video pools with real YouTube titles
const PHYSICS_VIDEOS = [
  { videoId: 'VVxDTH7Ywrk', title: 'Physics Marathon 2026 — Part 1', desc: 'Complete Physics Part 1 — One Shot by Rakshak Sir' },
  { videoId: 'euRS4IJ-V-0', title: 'Physics Marathon 2026 — Part 2', desc: 'Complete Physics Part 2 — One Shot by Rakshak Sir' },
  { videoId: 'V9vUxNVaqOw', title: 'Complete Physics — JEE 2026', desc: 'All Concepts & PYQs covered in one shot for JEE 2026' },
  { videoId: 'FSlOdXN7leo', title: 'Complete Physics — JEE 2025', desc: 'All Concepts & PYQs covered in one shot for JEE 2025' },
  { videoId: 'MCFrSja9aBI', title: 'Physics Final Exam Marathon', desc: 'All Chapters covered — Final Exam Marathon' },
  { videoId: '46CaYBwEp_k', title: 'Vectors — One Shot', desc: 'All Concepts, Tricks & PYQs on Vectors — Ummeed NEET' },
]

const CHEMISTRY_VIDEOS = [
  { videoId: 'axQXgnFREe8', title: 'Organic Chemistry — One Shot', desc: 'Complete Organic Chemistry Class 11 — All Concepts & PYQs — JEE Main' },
  { videoId: '6WT8bzC8MmQ', title: 'Organic Chemistry — Final Marathon', desc: 'All Chapters of Organic Chemistry covered in One Shot' },
  { videoId: 'BB43j3fu1E4', title: 'Basic Concepts of Chemistry', desc: 'Chapter 1 — NCERT + Equations + PYQs — One Shot' },
  { videoId: 'DuPGMwYrkaQ', title: 'Physical Chemistry — Final Marathon', desc: 'Complete Physical Chemistry — All Chapters — One Shot' },
  { videoId: 'pE_OfctVwnw', title: 'Chemistry Marathon 2026', desc: 'Complete Chemistry Revision — One Shot By Aakash Sir' },
]

const MATHS_VIDEOS = [
  { videoId: '4LxrzD-MRBk', title: 'Statistics — One Shot', desc: 'Full Chapter in One Shot — Chapter 13 — Class 11 Maths' },
  { videoId: 'kcSMOgFRp6w', title: 'Trigonometric Functions — One Shot', desc: 'Full Chapter in One Shot — Chapter 3 — Class 11 Maths' },
  { videoId: 'CHWhaAlo_ms', title: 'Limits & Derivatives — One Shot', desc: 'Full Chapter in One Shot — Chapter 12 — Class 11 Maths' },
  { videoId: '6I-EMg_z3XY', title: 'Basic Maths — JEE One Shot', desc: 'All Concepts & PYQs — Basic to Advanced — Class 11 JEE' },
  { videoId: 'WDjcpSCI-uU', title: 'Basic Maths — NEET One Shot', desc: 'All Concepts, Tricks & PYQs — Ummeed NEET' },
]

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function Home({ user, onLogout }) {
  const [playingVideo, setPlayingVideo] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

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

  const courses = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults
    }

    const p1 = pickRandom(PHYSICS_VIDEOS)
    const p2 = pickRandom(PHYSICS_VIDEOS)
    const c1 = pickRandom(CHEMISTRY_VIDEOS)
    const c2 = pickRandom(CHEMISTRY_VIDEOS)
    const m1 = pickRandom(MATHS_VIDEOS)
    const m2 = pickRandom(MATHS_VIDEOS)

    return [
      { icon: '', title: p1.title, description: p1.desc, progress: 72, tag: 'Popular', videoId: p1.videoId },
      { icon: '', title: c1.title, description: c1.desc, progress: 45, tag: 'Trending', videoId: c1.videoId },
      { icon: '', title: m1.title, description: m1.desc, progress: 33, tag: 'New', videoId: m1.videoId },
      { icon: '', title: p2.title, description: p2.desc, progress: 58, videoId: p2.videoId },
      { icon: '', title: c2.title, description: c2.desc, progress: 21, videoId: c2.videoId },
      { icon: '', title: m2.title, description: m2.desc, progress: 12, videoId: m2.videoId },
    ]
  }, [searchQuery])

  return (
    <div className="home-page">
      <Navbar user={user} onLogout={onLogout} onSearch={setSearchQuery} />
      <main className="home-content">
        {/* Hero Banner */}
        {!searchQuery && (
          <section className="home-hero">
            <div className="home-hero-content">
              <span className="home-hero-badge">Class 11 — JEE / NEET</span>
              <h1 className="home-hero-title">
                Padhai ko banao
                <span className="home-hero-accent"> asaan aur affordable</span>
              </h1>
              <p className="home-hero-desc">
                Physics, Chemistry, Maths — Complete syllabus with video lectures, notes, and doubt solving.
              </p>
            </div>
          </section>
        )}

        {/* Video Player Modal */}
        {playingVideo && (
          <div className="home-video-overlay" onClick={() => setPlayingVideo(null)}>
            <div className="home-video-modal" onClick={e => e.stopPropagation()}>
              <button className="home-video-close" onClick={() => setPlayingVideo(null)}>x</button>
              <div className="home-video-wrapper">
                <iframe
                  src={`https://www.youtube.com/embed/${playingVideo}?autoplay=1&rel=0`}
                  title="Lecture Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="home-video-iframe"
                />
              </div>
            </div>
          </div>
        )}

        {/* Courses Section */}
        <section className={`home-courses ${searchQuery ? 'search-results' : ''}`} id="courses-section">
          <div className="home-section-header">
            <h2>{searching ? 'Searching YouTube...' : (searchQuery ? `Search Results for "${searchQuery}"` : 'Explore Courses')}</h2>
            <span className="home-course-count">{courses.length} {courses.length === 1 ? 'result' : 'results'}</span>
          </div>
          {courses.length > 0 ? (
            <div className="home-courses-grid">
              {courses.map((course, i) => (
                <CourseCard key={i} {...course} onPlay={(vid) => setPlayingVideo(vid)} />
              ))}
            </div>
          ) : (
            <div className="home-no-results">
              <p>No videos found matching your search.</p>
            </div>
          )}
        </section>

        {/* Stats Section */}
        <section className="home-stats">
          <div className="home-stat-item">
            <span className="home-stat-number">15M+</span>
            <span className="home-stat-label">Students</span>
          </div>
          <div className="home-stat-item">
            <span className="home-stat-number">4.8</span>
            <span className="home-stat-label">Rating</span>
          </div>
          <div className="home-stat-item">
            <span className="home-stat-number">1000+</span>
            <span className="home-stat-label">Lectures</span>
          </div>
          <div className="home-stat-item">
            <span className="home-stat-number">Free</span>
            <span className="home-stat-label">Access</span>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Home
