// Global Miniplayer System
class MiniPlayer {
  constructor() {
    this.isVisible = false;
    this.currentVideoId = null;
    this.currentTitle = null;
    this.currentBand = null;
    this.player = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.init();
  }

  init() {
    // Create miniplayer HTML
    this.createMiniplayerHTML();
    
    // Add event listeners
    this.addEventListeners();
    
    // Load YouTube Player API
    this.loadYouTubeAPI();
    
    // Check if there's a saved state from previous page
    this.loadState();
  }

  loadYouTubeAPI() {
    // Check if YouTube API is already loaded
    if (window.YT && window.YT.Player) {
      return;
    }

    // Load YouTube Player API
    if (!document.getElementById('youtube-api-script')) {
      const script = document.createElement('script');
      script.id = 'youtube-api-script';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }

    // Set up global callback for when API is ready
    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube API loaded');
    };
  }

  createMiniplayerHTML() {
    const miniplayerHTML = `
      <div id="miniplayer" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        height: 80px;
        background: #111;
        border: 2px solid #aa0000;
        border-radius: 8px;
        display: none;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.8);
        font-family: Arial, sans-serif;
      ">
        <div style="
          display: flex;
          align-items: center;
          height: 90%;
          padding: 5px;
          gap: 10px;
        ">
          <div style="
            width: 60px;
            height: 60px;
            background: #333;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <div id="miniplayer-thumbnail" style="
              width: 100%;
              height: 100%;
              background-size: cover;
              background-position: center;
              border-radius: 4px;
            "></div>
          </div>
          
          <div style="
            flex: 1;
            min-width: 0;
            color: white;
          ">
            <div id="miniplayer-title" style="
              font-size: 14px;
              font-weight: bold;
              color: #aa0000;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin-bottom: 2px;
            "></div>
            <div id="miniplayer-band" style="
              font-size: 12px;
              color: #ccc;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            "></div>
          </div>
          
          <div style="
            display: flex;
            align-items: center;
          ">
            <button id="miniplayer-close" style="
              background: #666;
              color: white;
              border: none;
              width: 35px;
              height: 35px;
              border-radius: 50%;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              font-weight: bold;
            ">×</button>
          </div>
        </div>
      </div>
    `;

    // Add to body if not already present
    if (!document.getElementById('miniplayer')) {
      document.body.insertAdjacentHTML('beforeend', miniplayerHTML);
    }
  }

  addEventListeners() {
    // Close button
    const closeBtn = document.getElementById('miniplayer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }

  extractVideoId(url) {
    // Extract YouTube video ID from various URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  getThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  playVideo(url, title, band) {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      console.error('Could not extract video ID from URL:', url);
      return;
    }

    this.currentVideoId = videoId;
    this.currentTitle = title;
    this.currentBand = band;

    // Update miniplayer content
    const miniplayer = document.getElementById('miniplayer');
    const thumbnail = document.getElementById('miniplayer-thumbnail');
    const titleEl = document.getElementById('miniplayer-title');
    const bandEl = document.getElementById('miniplayer-band');

    if (miniplayer && thumbnail && titleEl && bandEl) {
      thumbnail.style.backgroundImage = `url(${this.getThumbnailUrl(videoId)})`;
      titleEl.textContent = title;
      bandEl.textContent = band;

      // Show miniplayer
      miniplayer.style.display = 'block';
      this.isVisible = true;

      // Automatically create and show the video player
      this.createVideoPlayer();

      // Save state to localStorage for persistence across pages
      this.saveState();
    }
  }

  createVideoPlayer() {
    if (!this.currentVideoId) return;

    // Wait for YouTube API to be ready
    if (!window.YT || !window.YT.Player) {
      console.log('YouTube API not ready yet, waiting...');
      setTimeout(() => this.createVideoPlayer(), 500);
      return;
    }

    let playerContainer = document.getElementById('miniplayer-player');
    
    if (!playerContainer) {
      // Create player container
      const miniplayer = document.getElementById('miniplayer');
      if (miniplayer) {
        const container = document.createElement('div');
        container.id = 'miniplayer-player';
        container.style.cssText = `
          position: fixed;
          bottom: 110px;
          right: 20px;
          width: 350px;
          height: 200px;
          border: 2px solid #aa0000;
          border-radius: 8px;
          z-index: 10001;
          background: #000;
        `;
        document.body.appendChild(container);

        // Create YouTube player
        this.player = new window.YT.Player('miniplayer-player', {
          height: '200',
          width: '350',
          videoId: this.currentVideoId,
          playerVars: {
            controls: 1,
            showinfo: 0,
            rel: 0,
            modestbranding: 1,
            autoplay: 1
          },
          events: {
            'onReady': (event) => {
              console.log('Player ready');
              // Restore saved time if available
              if (this.currentTime > 0) {
                event.target.seekTo(this.currentTime, true);
              }
              // Always start playing
              event.target.playVideo();
            },
            'onStateChange': (event) => {
              // Save current time periodically
              if (event.data === window.YT.PlayerState.PLAYING) {
                this.isPlaying = true;
                this.startTimeTracking();
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                this.isPlaying = false;
                this.stopTimeTracking();
              } else if (event.data === window.YT.PlayerState.ENDED) {
                this.isPlaying = false;
                this.stopTimeTracking();
              }
            }
          }
        });
      }
    }
  }

  startTimeTracking() {
    this.stopTimeTracking(); // Clear any existing interval
    this.timeInterval = setInterval(() => {
      if (this.player && this.player.getCurrentTime) {
        this.currentTime = this.player.getCurrentTime();
        this.saveState();
      }
    }, 1000); // Save time every second
  }

  stopTimeTracking() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }


  close() {
    const miniplayer = document.getElementById('miniplayer');
    const playerContainer = document.getElementById('miniplayer-player');
    
    if (miniplayer) {
      miniplayer.style.display = 'none';
    }
    
    if (playerContainer) {
      playerContainer.remove();
    }
    
    // Stop time tracking
    this.stopTimeTracking();
    
    // Destroy YouTube player
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    
    this.isVisible = false;
    this.currentVideoId = null;
    this.currentTitle = null;
    this.currentBand = null;
    this.isPlaying = false;
    this.currentTime = 0;
    
    // Clear saved state
    localStorage.removeItem('miniplayerState');
  }

  saveState() {
    const state = {
      videoId: this.currentVideoId,
      title: this.currentTitle,
      band: this.currentBand,
      isVisible: this.isVisible,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime
    };
    localStorage.setItem('miniplayerState', JSON.stringify(state));
  }

  loadState() {
    try {
      const savedState = localStorage.getItem('miniplayerState');
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.isVisible && state.videoId && state.title && state.band) {
          // Restore miniplayer state
          this.currentVideoId = state.videoId;
          this.currentTitle = state.title;
          this.currentBand = state.band;
          this.isPlaying = state.isPlaying || false;
          this.currentTime = state.currentTime || 0;
          
          // Update UI
          const miniplayer = document.getElementById('miniplayer');
          const thumbnail = document.getElementById('miniplayer-thumbnail');
          const titleEl = document.getElementById('miniplayer-title');
          const bandEl = document.getElementById('miniplayer-band');

          if (miniplayer && thumbnail && titleEl && bandEl) {
            thumbnail.style.backgroundImage = `url(${this.getThumbnailUrl(state.videoId)})`;
            titleEl.textContent = state.title;
            bandEl.textContent = state.band;
            miniplayer.style.display = 'block';
            this.isVisible = true;
            
            // Automatically create and show the video player
            this.createVideoPlayer();
          }
        }
      }
    } catch (error) {
      console.error('Error loading miniplayer state:', error);
    }
  }
}

// Global miniplayer instance
window.miniPlayer = new MiniPlayer();

// Function to play video in miniplayer (called by listen buttons)
window.playInMiniPlayer = function(url, title, band) {
  window.miniPlayer.playVideo(url, title, band);
};

// Handle page navigation - recreate player if needed
window.addEventListener('beforeunload', () => {
  if (window.miniPlayer && window.miniPlayer.player) {
    // Save current time before leaving page
    if (window.miniPlayer.player.getCurrentTime) {
      window.miniPlayer.currentTime = window.miniPlayer.player.getCurrentTime();
      window.miniPlayer.saveState();
    }
  }
});

// Recreate player when page loads if there's a saved state
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure YouTube API is loaded
  setTimeout(() => {
    if (window.miniPlayer && window.miniPlayer.isVisible && window.miniPlayer.currentVideoId) {
      // Player will be recreated when user clicks play button
      console.log('Miniplayer state restored, ready to recreate player');
    }
  }, 1000);
});
