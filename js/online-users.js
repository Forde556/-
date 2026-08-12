// ============================================================
// Real-time Online Users Tracking System
// Tracks active users and displays count in real-time
// ============================================================

let currentUserSession = null;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const SESSION_TIMEOUT = 60000; // 60 seconds

class OnlineUsersTracker {
  constructor() {
    this.db = null;
    this.currentUserId = null;
    this.heartbeatInterval = null;
    this.sessionRef = null;
  }

  async init() {
    // Wait for Firebase to be ready
    if (!window.Api || !window.Auth) {
      setTimeout(() => this.init(), 1000);
      return;
    }

    try {
      const user = await Auth.getUser();
      if (!user) {
        this.trackAnonymousUser();
        return;
      }

      this.currentUserId = user.id;
      await this.registerOnlineUser(user);
      this.startHeartbeat();
      this.loadOnlineCount();
      
      // Cleanup on page unload
      window.addEventListener("beforeunload", () => this.unregisterUser());
    } catch (error) {
      console.error("Online users tracker init error:", error);
    }
  }

  async registerOnlineUser(user) {
    try {
      const sessionId = `${this.currentUserId}_${Date.now()}`;
      const profile = await Api.getProfile(this.currentUserId);
      
      // Store session in localStorage
      currentUserSession = {
        id: sessionId,
        userId: this.currentUserId,
        userName: profile?.full_name || "مستخدم",
        email: user.email,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        isAdmin: profile?.is_admin || false
      };

      localStorage.setItem("userSession", JSON.stringify(currentUserSession));
      
      // Log activity
      await Api.logActivity(this.currentUserId, "login");
      
    } catch (error) {
      console.error("Register online user error:", error);
    }
  }

  async trackAnonymousUser() {
    // Track anonymous visitors
    currentUserSession = {
      id: `anonymous_${Date.now()}`,
      userId: "anonymous",
      userName: "زائر",
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isAdmin: false
    };
    
    localStorage.setItem("userSession", JSON.stringify(currentUserSession));
    this.loadOnlineCount();
  }

  startHeartbeat() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (this.currentUserId) {
        try {
          await Api.logActivity(this.currentUserId, "heartbeat");
          currentUserSession.lastActive = new Date().toISOString();
          localStorage.setItem("userSession", JSON.stringify(currentUserSession));
        } catch (error) {
          console.error("Heartbeat error:", error);
        }
      }
      this.loadOnlineCount();
    }, HEARTBEAT_INTERVAL);
  }

  async unregisterUser() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.currentUserId) {
      try {
        await Api.logActivity(this.currentUserId, "logout");
      } catch (error) {
        console.error("Unregister error:", error);
      }
    }
    
    localStorage.removeItem("userSession");
  }

  async loadOnlineCount() {
    try {
      // Count users with recent activity
      const now = Date.now();
      const activeUsers = this.getActiveUsersFromStorage();
      const onlineCount = activeUsers.length;
      
      // Update UI
      const countElement = document.getElementById("onlineUsersCount");
      if (countElement) {
        countElement.textContent = onlineCount;
        
        // Animate change
        countElement.style.transform = "scale(1.2)";
        setTimeout(() => {
          countElement.style.transform = "scale(1)";
        }, 200);
      }
      
      // Store in localStorage for admin dashboard
      localStorage.setItem("onlineUsersCount", onlineCount);
      localStorage.setItem("onlineUsers", JSON.stringify(activeUsers));
      
    } catch (error) {
      console.error("Load online count error:", error);
    }
  }

  getActiveUsersFromStorage() {
    // Get all active users from localStorage
    const users = [];
    const now = Date.now();
    
    // Check current session
    const session = localStorage.getItem("userSession");
    if (session) {
      try {
        const userData = JSON.parse(session);
        const lastActive = new Date(userData.lastActive).getTime();
        
        // User is active if logged in within last 60 seconds
        if (now - lastActive < SESSION_TIMEOUT) {
          users.push(userData);
        }
      } catch (e) {
        console.error("Parse session error:", e);
      }
    }
    
    return users;
  }

  getOnlineCount() {
    const users = this.getActiveUsersFromStorage();
    return users.length;
  }

  getOnlineUsers() {
    return this.getActiveUsersFromStorage();
  }
}

// Initialize tracker when page loads
const onlineTracker = new OnlineUsersTracker();

window.addEventListener("load", () => {
  onlineTracker.init();
});

// Update online count every 5 seconds on all pages
setInterval(() => {
  if (onlineTracker) {
    onlineTracker.loadOnlineCount();
  }
}, 5000);

// Expose tracker to window for use in admin dashboard
window.onlineTracker = onlineTracker;
