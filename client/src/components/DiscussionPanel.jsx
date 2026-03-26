import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import YouTubePlayer from './YouTubePlayer'
import './DiscussionPanel.css'

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

function DiscussionPanel({ user, socket, onPanic, onStreamChange, onLogout }) {
  const [entries, setEntries] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [miniOnline, setMiniOnline] = useState(false)
  const [toast, setToast] = useState(null)
  const [syncedVideoId, setSyncedVideoId] = useState(null)
  const navigate = useNavigate()
  const listEndRef = useRef(null)
  const listRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)

  const isMini = user.id === 'u1'
  const isAvni = user.id === 'u2'

  const scrollToBottom = () => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const cleanupRTC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (onStreamChange) onStreamChange(null)
  }, [onStreamChange])

  // Mini: acquire camera and create offer
  const startStreaming = useCallback(async (socket) => {
    // Clean up any old connection
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    try {
      // Get camera if not already active
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        })
        localStreamRef.current = stream
        console.log('[Stream] Camera acquired')
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      pcRef.current = pc

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('rtc-ice-candidate', e.candidate)
      }

      pc.oniceconnectionstatechange = () => {
        console.log('[Stream] Mini ICE:', pc.iceConnectionState)
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('rtc-offer', offer)
      console.log('[Stream] Offer sent')
    } catch (err) {
      console.log('[Stream] Camera error:', err.message)
    }
  }, [])

  // Avni: handle incoming offer
  const handleOffer = useCallback(async (offer, socket) => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = (e) => {
      console.log('[Stream] Track received')
      if (e.streams[0] && onStreamChange) {
        onStreamChange(e.streams[0])
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('rtc-ice-candidate', e.candidate)
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[Stream] Avni ICE:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (onStreamChange) onStreamChange(null)
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket.emit('rtc-answer', answer)
    console.log('[Stream] Answer sent')
  }, [onStreamChange])

  // Helper to show system notifications via Service Worker (more reliable for mobile)
  const showSystemNotification = useCallback((title, options) => {
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options,
          }).catch(err => {
            console.error('SW Notification error:', err)
            // Fallback to standard notification if SW fails
            new Notification(title, options)
          })
        })
      } else {
        new Notification(title, options)
      }
    }
  }, [])

  useEffect(() => {
    // Fetch existing entries
    const apiUrl = "http://localhost:3001"
    fetch(`${apiUrl}/api/data`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.entries) setEntries(data.entries)
      })
      .catch(() => {})

    if (!socket) return

    socket.on('connect', () => {
      setConnected(true)
      if (isAvni) socket.emit('get-initial-status')
    })
    socket.on('disconnect', () => setConnected(false))

    socket.on('new-entry', (entry) => {
      setEntries((prev) => [...prev, entry])

      // Avni: show notification when someone messages
      if (isAvni && entry.authorId !== user.id) {
        showSystemNotification('StudyHub', {
          body: `${entry.author}: ${entry.content || (entry.image ? 'sent an image' : '')}`,
          tag: 'studyhub-msg',
        })
      }
    })

    socket.on('video-selected', (videoId) => {
      setSyncedVideoId(videoId)
    })

    socket.on('entries-cleared', () => {
      setEntries([])
    })

    // Mini: listen for force-logout from Avni
    if (isMini) {
      socket.on('force-logout', () => {
        sessionStorage.removeItem('studyhub_user')
        if (onLogout) onLogout()
        navigate('/')
      })
    }

    // --- Mini: camera streaming ---
    if (isMini) {
      // Request camera immediately on mount so it's ready
      navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      }).then((stream) => {
        localStreamRef.current = stream
        console.log('[Stream] Camera pre-acquired on mount')
      }).catch(() => {
        console.log('[Stream] Camera denied on mount')
      })

      // When avni comes online (or is already online), create the connection
      socket.on('viewer-ready', () => {
        console.log('[Stream] viewer-ready received')
        startStreaming(socket)
      })

      socket.on('rtc-answer', async (answer) => {
        if (pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
          console.log('[Stream] Answer applied')
        }
      })
    }

    // --- Avni: receive stream ---
    if (isAvni) {
      socket.on('rtc-offer', (offer) => {
        console.log('[Stream] Offer received')
        handleOffer(offer, socket)
      })

      socket.on('streamer-online', () => {
        console.log('[Stream] Mini came online')
        setMiniOnline(true)
        setToast({ message: 'Mini is now online', type: 'online' })
        setTimeout(() => setToast(null), 3000)

        showSystemNotification('StudyHub', {
          body: 'Mini is now online',
          tag: 'studyhub-online',
        })
      })

      socket.on('streamer-offline', () => {
        console.log('[Stream] Streamer offline')
        setMiniOnline(false)
        setToast({ message: 'Mini went offline', type: 'offline' })
        setTimeout(() => setToast(null), 3000)
        cleanupRTC()

        showSystemNotification('StudyHub', {
          body: 'Mini went offline',
          tag: 'studyhub-offline',
        })
      })
    }

    // Both: ICE candidates
    socket.on('rtc-ice-candidate', (candidate) => {
      if (pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      }
    })

    return () => {
      cleanupRTC()
      // Note: socket cleanup handled by parent (Dashboard)
    }
  }, [socket])

  useEffect(() => {
    scrollToBottom()
  }, [entries])

  const handleSubmit = (e) => {
    e.preventDefault()
    const content = input.trim()
    if ((!content && !pendingImage) || !socket) return
    socket.emit('submit-entry', { content, image: pendingImage })
    setInput('')
    setPendingImage(null)
  }

  const handleImagePick = () => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 4 * 1024 * 1024) {
        alert('Image must be under 4MB')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setPendingImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
    fileInput.click()
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const getAvatarColor = (name) => {
    const colors = [
      'linear-gradient(135deg, #1a73e8, #4a9af5)',
      'linear-gradient(135deg, #00c853, #69f0ae)',
      'linear-gradient(135deg, #ff6d00, #ffa040)',
      'linear-gradient(135deg, #e91e63, #f48fb1)',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="discussion-panel" id="discussion-panel">
      <div className="discussion-header">
        <div className="discussion-header-left">
          <h2 className="discussion-title">Doubt Section</h2>
          <p className="discussion-subtitle">Ask questions, share notes, and resolve doubts</p>
        </div>
        <div className="discussion-header-right">
          {isAvni && (
            <div className={`mini-status-badge ${miniOnline ? 'online' : 'offline'}`}>
              <span className="status-dot"></span>
              {miniOnline ? 'Mini Online' : 'Mini Offline'}
              {Notification.permission === 'default' && (
                <button
                  className="enable-notifs-btn"
                  onClick={() => Notification.requestPermission().then(() => window.location.reload())}
                  title="Enable browser notifications"
                >
                  🔔
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`discussion-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="discussion-list" ref={listRef} id="discussion-entries">
        {entries.length === 0 ? (
          <div className="discussion-empty">
            <p>No doubts posted yet. Be the first to ask!</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`discussion-entry ${entry.authorId === user.id ? 'discussion-entry-own' : ''}`}
              id={`entry-${entry.id}`}
            >
              <div
                className="discussion-entry-avatar"
                style={{ background: getAvatarColor(entry.author) }}
              >
                {entry.author[0]}
              </div>
              <div className="discussion-entry-body">
                <div className="discussion-entry-meta">
                  <span className="discussion-entry-author">{entry.author}</span>
                  <span className="discussion-entry-time">{formatTime(entry.timestamp)}</span>
                </div>
                {entry.content && <p className="discussion-entry-content">{entry.content}</p>}
                {entry.image && (
                  <img
                    src={entry.image}
                    alt="Shared image"
                    className="discussion-entry-image"
                    onClick={() => window.open(entry.image, '_blank')}
                  />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      {/* Image preview strip */}
      {pendingImage && (
        <div className="discussion-image-preview">
          <img src={pendingImage} alt="Preview" className="discussion-image-thumb" />
          <button
            type="button"
            className="discussion-image-remove"
            onClick={() => setPendingImage(null)}
          >x</button>
        </div>
      )}

      <form className="discussion-input-bar" onSubmit={handleSubmit} id="discussion-form">
        {/* Panic button — only for Mini */}
        {onPanic && (
          <button
            type="button"
            className="discussion-panic-btn"
            onClick={onPanic}
            title="Emergency exit"
            id="panic-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}

        {/* Kick Mini button — only for Avni */}
        {isAvni && miniOnline && (
          <button
            type="button"
            className="discussion-kick-btn"
            onClick={() => socket && socket.emit('force-logout')}
            title="Force logout Mini"
            id="kick-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        )}

        {/* Image attachment button */}
        <button
          type="button"
          className="discussion-attach-btn"
          onClick={handleImagePick}
          title="Attach image"
          id="attach-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>

        <input
          type="text"
          className="discussion-input"
          placeholder="Ask a doubt..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          id="discussion-input"
        />
        <button
          type="submit"
          className="discussion-send-btn"
          disabled={(!input.trim() && !pendingImage) || !connected}
          id="discussion-submit"
          aria-label="Post doubt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>

      <YouTubePlayer 
        videoId={syncedVideoId} 
        onTouchClose={() => setSyncedVideoId(null)} 
      />
    </div>
  )
}

export default DiscussionPanel

