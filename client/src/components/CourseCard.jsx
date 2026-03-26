import './CourseCard.css'

function CourseCard({ icon, title, description, progress, tag, videoId, onPlay }) {
  // Use mqdefault which is guaranteed to exist for all videos, unlike hqdefault
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null

  return (
    <div className="course-card" id={`course-${title.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => onPlay && onPlay(videoId)}>
      {thumbnailUrl && (
        <div className="course-card-thumbnail">
          <img src={thumbnailUrl} alt={title} className="course-card-thumb-img" />
          <div className="course-card-play-overlay">
            <div className="course-card-play-btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
          {tag && <span className="course-card-tag">{tag}</span>}
        </div>
      )}
      <div className="course-card-body">
        <div className="course-card-title-row">
          {icon && <span className="course-card-icon">{icon}</span>}
          <h3 className="course-card-title">{title}</h3>
        </div>
        <p className="course-card-desc">{description}</p>
        <div className="course-card-meta">
          <span className="course-card-instructor">Alakh Pandey</span>
          <span className="course-card-dot">•</span>
          <span className="course-card-level">Class 11</span>
        </div>
        <div className="course-card-progress">
          <div className="course-card-progress-bar">
            <div className="course-card-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="course-card-progress-text">{progress}% complete</span>
        </div>
      </div>
    </div>
  )
}

export default CourseCard
