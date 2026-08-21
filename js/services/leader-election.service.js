/**
 * FocusFlow Web - Services: Leader Election & Inter-Tab Synchronization
 * Coordina múltiples pestañas y ventanas del navegador en tiempo real (BroadcastChannel API),
 * garantizando que solo 1 pestaña "Líder" ejecute alertas de audio y cronómetros.
 */

class LeaderElectionService {
  constructor() {
    this.tabId = "tab_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
    this.channelName = "edhuflow_tab_sync";
    this.channel = null;
    this.isCurrentLeader = false;
    this.lastLeaderHeartbeat = 0;
    this.heartbeatInterval = null;
    this.checkInterval = null;
    this.messageListeners = new Map();

    this._initChannel();
    this._startElection();
  }

  _initChannel() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event) => this._handleMessage(event.data);
      } catch (e) {
        console.warn("[LeaderElection] Error al inicializar BroadcastChannel:", e);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this.isCurrentLeader) {
          this.postMessage({ type: "LEADER_RELEASE", tabId: this.tabId });
        }
      });
    }
  }

  _startElection() {
    this.postMessage({ type: "PING_LEADER", tabId: this.tabId });

    this.checkInterval = setInterval(() => {
      const now = Date.now();
      if (!this.isCurrentLeader) {
        if (now - this.lastLeaderHeartbeat > 2500) {
          this._claimLeadership();
        }
      }
    }, 1000);

    setTimeout(() => {
      if (!this.isCurrentLeader && Date.now() - this.lastLeaderHeartbeat > 600) {
        this._claimLeadership();
      }
    }, 600);
  }

  _claimLeadership() {
    this.isCurrentLeader = true;
    this.lastLeaderHeartbeat = Date.now();
    console.log("👑 [LeaderElection] Esta pestaña (" + this.tabId + ") asumió el Liderazgo Activo.");
    
    this.postMessage({ type: "LEADER_CLAIM", tabId: this.tabId });

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.isCurrentLeader) {
        this.postMessage({ type: "HEARTBEAT", tabId: this.tabId, timestamp: Date.now() });
      }
    }, 1000);
  }

  _handleMessage(msg) {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "HEARTBEAT") {
      this.lastLeaderHeartbeat = Date.now();
      if (msg.tabId !== this.tabId && this.isCurrentLeader) {
        if (msg.tabId < this.tabId) {
          this.isCurrentLeader = false;
          if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
          console.log("[LeaderElection] Cediendo liderazgo a la pestaña " + msg.tabId);
        }
      }
    } else if (msg.type === "LEADER_CLAIM") {
      if (msg.tabId !== this.tabId) {
        this.lastLeaderHeartbeat = Date.now();
        if (this.isCurrentLeader && msg.tabId < this.tabId) {
          this.isCurrentLeader = false;
          if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        }
      }
    } else if (msg.type === "PING_LEADER") {
      if (this.isCurrentLeader) {
        this.postMessage({ type: "HEARTBEAT", tabId: this.tabId, timestamp: Date.now() });
      }
    } else if (msg.type === "LEADER_RELEASE") {
      if (msg.tabId !== this.tabId) {
        this.lastLeaderHeartbeat = 0;
        this._claimLeadership();
      }
    }

    if (this.messageListeners.has(msg.type)) {
      this.messageListeners.get(msg.type).forEach((cb) => {
        try { cb(msg.payload); } catch (err) { console.warn("[LeaderElection] Listener error:", err); }
      });
    }
  }

  postMessage(data) {
    if (this.channel) {
      try {
        this.channel.postMessage(data);
      } catch (e) {}
    }
  }

  broadcast(type, payload) {
    this.postMessage({ type, payload, senderTabId: this.tabId });
  }

  on(type, callback) {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, new Set());
    }
    this.messageListeners.get(type).add(callback);
    return () => this.messageListeners.get(type)?.delete(callback);
  }

  isLeader() {
    return this.isCurrentLeader;
  }
}

export const leaderElectionService = new LeaderElectionService();
