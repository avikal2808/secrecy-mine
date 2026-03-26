import { useState } from 'react'
import './YouTubeSearch.css'

function YouTubeSearch({ onVideoSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const apiUrl = "http://localhost:3001"
      const res = await fetch(`${apiUrl}/api/youtube/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to search')
      }

      const data = await res.json()
      console.log("YouTube API response:", data)
      setResults(data.results || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="youtube-search">
      <form onSubmit={handleSearch} className="youtube-search-bar">
        <input
          type="text"
          placeholder="Search YouTube..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="youtube-search-input"
        />
        <button type="submit" className="youtube-search-btn" disabled={loading}>
          {loading ? '...' : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </button>
      </form>

      {error && <div className="youtube-search-error">{error}</div>}

      <div className="youtube-results-list">
        {results.map((video) => (
          <div
            key={video.videoId}
            className="youtube-result-item"
            onClick={() => onVideoSelect(video.videoId)}
          >
            <img src={video.thumbnail} alt={video.title} className="youtube-result-thumb" />
            <div className="youtube-result-info">
              <h4 className="youtube-result-title">{video.title}</h4>
            </div>
          </div>
        ))}
        {!loading && results.length === 0 && query && (
          <p className="youtube-no-results">No videos found.</p>
        )}
      </div>
    </div>
  )
}

export default YouTubeSearch
