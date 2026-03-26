import './YouTubePlayer.css'

function YouTubePlayer({ videoId, onTouchClose }) {
  if (!videoId) return null

  return (
    <div className="youtube-player-subwindow">
      <div className="youtube-player-header">
        <span className="youtube-player-title">Synced Playback</span>
        <button className="youtube-player-close" onClick={onTouchClose}>x</button>
      </div>
      <div className="youtube-player-container">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="youtube-player-iframe"
        />
      </div>
    </div>
  )
}

export default YouTubePlayer
