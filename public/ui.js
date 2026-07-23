// ─── UI Controller ────────────────────────────────────────────────────────────
// Handles: Auth (login/register), Panel switching, Match list, DM chat, Avatar editor, Dating

// Global utility (shared with app.js and profile-card.js)
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const UI = {
  token: null,
  user: null,
  isGuest: true,
  currentConvoId: null,
  currentConvoPartner: null,
  avatarData: null,
  shopItems: [],

  // ─── INIT ──────────────────────────────────────────────────────
  init() {
    this.setupAuthTabs();
    this.setupAuthForms();
    this.setupPanelTabs();
    this.setupChatPanel();
    this.setupAvatarPanel();
    this.setupShop();
    this.setupDating();
    this.checkStoredAuth();
    this.setMaxDob();
  },

  setMaxDob() {
    const dob = document.getElementById('reg-dob');
    if (dob) {
      const max = new Date();
      max.setFullYear(max.getFullYear() - 18);
      dob.max = max.toISOString().split('T')[0];
    }
  },

  // ─── STORED AUTH (auto-login) ──────────────────────────────────
  checkStoredAuth() {
    const token = localStorage.getItem('pmw_token');
    const refresh = localStorage.getItem('pmw_refresh');
    if (token) {
      this.token = token;
      this.isGuest = false;
      this.fetchProfile().then(() => {
        this.enterWorld();
      }).catch(() => {
        // Token expired, try refresh
        if (refresh) {
          this.refreshToken(refresh).catch(() => {
            localStorage.removeItem('pmw_token');
            localStorage.removeItem('pmw_refresh');
          });
        }
      });
    }
    // Check for Line OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success') === '1') {
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');
      if (accessToken) {
        this.setAuth(accessToken, refreshToken);
        window.history.replaceState({}, '', '/');
        this.fetchProfile().then(() => this.enterWorld());
      }
    }
  },

  setAuth(accessToken, refreshToken) {
    this.token = accessToken;
    this.isGuest = false;
    localStorage.setItem('pmw_token', accessToken);
    if (refreshToken) localStorage.setItem('pmw_refresh', refreshToken);
  },

  async refreshToken(refreshToken) {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    this.setAuth(data.accessToken, refreshToken);
    return data;
  },

  // ─── AUTH TABS ─────────────────────────────────────────────────
  setupAuthTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  },

  // ─── AUTH FORMS ────────────────────────────────────────────────
  setupAuthForms() {
    // Login
    document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    // Register
    document.getElementById('register-btn').addEventListener('click', () => this.handleRegister());

    // Line login
    document.getElementById('line-login-btn').addEventListener('click', () => {
      window.location.href = '/api/auth/line';
    });

    // Guest
    document.getElementById('join-btn').addEventListener('click', () => this.handleGuestJoin());
    document.getElementById('nickname-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleGuestJoin();
    });
  },

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    if (!email || !password) {
      this.showError(errorEl, 'Please enter email and password');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        this.showError(errorEl, data.error || 'Login failed');
        return;
      }
      this.user = data.user;
      this.setAuth(data.accessToken, data.refreshToken);
      this.enterWorld();
    } catch (e) {
      this.showError(errorEl, 'Network error');
    }
  },

  async handleRegister() {
    const nickname = document.getElementById('reg-nickname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const dob = document.getElementById('reg-dob').value;
    const errorEl = document.getElementById('reg-error');
    errorEl.classList.add('hidden');

    if (!nickname || !email || !password || !dob) {
      this.showError(errorEl, 'All fields are required');
      return;
    }
    if (password.length < 8) {
      this.showError(errorEl, 'Password must be at least 8 characters');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname, dateOfBirth: dob })
      });
      const data = await res.json();
      if (!res.ok) {
        this.showError(errorEl, data.error || 'Registration failed');
        return;
      }
      this.user = data.user;
      this.setAuth(data.accessToken, data.refreshToken);
      this.enterWorld();
    } catch (e) {
      this.showError(errorEl, 'Network error');
    }
  },

  handleGuestJoin() {
    this.isGuest = true;
    this.token = null;
    this.enterWorld();
  },

  showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  // ─── ENTER WORLD ──────────────────────────────────────────────
  enterWorld() {
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    // Show/hide auth-only features
    if (!this.isGuest) {
      document.querySelectorAll('.auth-only-msg').forEach(el => el.classList.add('hidden'));
      document.getElementById('avatar-editor').classList.remove('hidden');
      this.loadMatches();
      this.loadConversations();
      this.loadAvatar();
      this.loadLikesRemaining();
    } else {
      document.querySelectorAll('.auth-only-msg').forEach(el => el.classList.remove('hidden'));
      document.getElementById('avatar-editor').classList.add('hidden');
    }

    // Trigger game connection (defined in app.js)
    if (typeof joinWorld === 'function') {
      joinWorld();
    }
  },

  // ─── PANEL TABS ────────────────────────────────────────────────
  setupPanelTabs() {
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
      });
    });
  },

  // ─── MATCHES ───────────────────────────────────────────────────
  async loadMatches() {
    if (this.isGuest) return;
    try {
      const res = await fetch('/api/matches', { headers: { 'Authorization': 'Bearer ' + this.token } });
      const data = await res.json();
      this.renderMatches(data.matches || []);
    } catch (e) {}
  },

  renderMatches(matches) {
    const list = document.getElementById('match-list');
    const noMatches = document.getElementById('no-matches');
    if (matches.length === 0) {
      noMatches.classList.remove('hidden');
      return;
    }
    noMatches.classList.add('hidden');
    list.innerHTML = matches.map(m => `
      <div class="match-item" data-convo="${m.conversationId}" data-partner="${m.partner?.display_name || m.partner?.nickname}">
        <div class="match-avatar-small"></div>
        <div class="match-info">
          <span class="match-name">${escapeHtml(m.partner?.display_name || 'User')}</span>
          <span class="match-date">${new Date(m.matchedAt).toLocaleDateString()}</span>
        </div>
        <button class="btn-small match-chat-btn" onclick="UI.openChat('${m.conversationId}', '${escapeHtml(m.partner?.display_name || 'User')}')">Chat</button>
        <button class="btn-small match-date-btn" onclick="UI.inviteDate('${m.partner?.id}')">💌</button>
      </div>
    `).join('');
  },

  async loadLikesRemaining() {
    if (this.isGuest) return;
    try {
      const res = await fetch('/api/matches/likes-remaining', { headers: { 'Authorization': 'Bearer ' + this.token } });
      const data = await res.json();
      const el = document.getElementById('likes-remaining');
      if (data.limit === 'unlimited') {
        el.textContent = 'Unlimited likes (Premium)';
      } else {
        el.textContent = `${data.remaining}/${data.limit} likes today`;
      }
    } catch (e) {}
  },

  // ─── CHAT PANEL ────────────────────────────────────────────────
  setupChatPanel() {
    document.getElementById('chat-back-btn')?.addEventListener('click', () => this.closeChatView());
    document.getElementById('dm-send-btn')?.addEventListener('click', () => this.sendDM());
    document.getElementById('dm-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendDM();
    });
  },

  async loadConversations() {
    if (this.isGuest) return;
    try {
      const res = await fetch('/api/chat/conversations', { headers: { 'Authorization': 'Bearer ' + this.token } });
      const data = await res.json();
      this.renderConversations(data.conversations || []);
    } catch (e) {}
  },

  renderConversations(convos) {
    const list = document.getElementById('chat-conversation-list');
    const noConvos = document.getElementById('no-convos');
    if (convos.length === 0) {
      noConvos.classList.remove('hidden');
      return;
    }
    noConvos.classList.add('hidden');
    list.innerHTML = convos.map(c => `
      <div class="convo-item" onclick="UI.openChat('${c.id}', '${escapeHtml(c.partner?.display_name || 'User')}')">
        <div class="convo-info">
          <span class="convo-name">${escapeHtml(c.partner?.display_name || 'User')}</span>
          <span class="convo-preview">${c.lastMessage ? escapeHtml(c.lastMessage.content) : 'No messages'}</span>
        </div>
        ${c.unreadCount > 0 ? `<span class="convo-unread">${c.unreadCount}</span>` : ''}
      </div>
    `).join('');
  },

  async openChat(convoId, partnerName) {
    this.currentConvoId = convoId;
    this.currentConvoPartner = partnerName;

    // Switch to chat panel
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-panel="chat"]').classList.add('active');
    document.getElementById('panel-chat').classList.add('active');

    // Show messages view
    document.getElementById('chat-conversation-list').classList.add('hidden');
    document.getElementById('chat-messages-view').classList.remove('hidden');
    document.getElementById('chat-panel-header').classList.remove('hidden');
    document.getElementById('chat-partner-name').textContent = partnerName;

    // Load messages
    try {
      const res = await fetch(`/api/chat/conversations/${convoId}/messages`, {
        headers: { 'Authorization': 'Bearer ' + this.token }
      });
      const data = await res.json();
      this.renderMessages(data.messages || []);
    } catch (e) {}

    document.getElementById('dm-input').focus();
  },

  closeChatView() {
    this.currentConvoId = null;
    document.getElementById('chat-conversation-list').classList.remove('hidden');
    document.getElementById('chat-messages-view').classList.add('hidden');
    document.getElementById('chat-panel-header').classList.add('hidden');
    this.loadConversations();
  },

  renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(m => {
      const isMine = m.sender_id === this.user?.id;
      return `<div class="dm-msg ${isMine ? 'dm-mine' : 'dm-theirs'}">
        <span class="dm-text">${escapeHtml(m.content)}</span>
        <span class="dm-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  },

  sendDM() {
    const input = document.getElementById('dm-input');
    const content = input.value.trim();
    if (!content || !this.currentConvoId || !socket) return;

    socket.emit('dm:send', { conversationId: this.currentConvoId, content });
    input.value = '';

    // Optimistic add to UI
    const container = document.getElementById('chat-messages');
    container.innerHTML += `<div class="dm-msg dm-mine"><span class="dm-text">${escapeHtml(content)}</span><span class="dm-time">now</span></div>`;
    container.scrollTop = container.scrollHeight;
  },

  // Called when receiving a DM via socket
  onDmReceive(msg) {
    if (msg.conversationId === this.currentConvoId) {
      const container = document.getElementById('chat-messages');
      container.innerHTML += `<div class="dm-msg dm-theirs"><span class="dm-text">${escapeHtml(msg.content)}</span><span class="dm-time">now</span></div>`;
      container.scrollTop = container.scrollHeight;
    }
    // Update badge/count
    this.loadConversations();
  },

  // ─── AVATAR PANEL ──────────────────────────────────────────────
  setupAvatarPanel() {
    document.getElementById('save-avatar-btn')?.addEventListener('click', () => this.saveAvatar());
    document.getElementById('open-shop-btn')?.addEventListener('click', () => this.openShop());

    // Body type buttons
    document.querySelectorAll('#body-type-options .av-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#body-type-options .av-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  async loadAvatar() {
    if (this.isGuest) return;
    try {
      const res = await fetch('/api/avatars/me', { headers: { 'Authorization': 'Bearer ' + this.token } });
      const data = await res.json();
      this.avatarData = data;
      this.renderAvatarEditor(data);
    } catch (e) {}
  },

  renderAvatarEditor(data) {
    // Set body type
    document.querySelectorAll('#body-type-options .av-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === data.body_type);
    });

    // Render hair colors
    const hairContainer = document.getElementById('hair-color-options');
    const hairColors = data.availableHairColors || [];
    hairContainer.innerHTML = hairColors.map(c =>
      `<button class="color-btn ${c === data.hair_color ? 'selected' : ''}" data-color="${c}" style="background:${c}" onclick="UI.selectHairColor('${c}')"></button>`
    ).join('');

    // Render skin tones
    const skinContainer = document.getElementById('skin-tone-options');
    const skinTones = data.availableSkinTones || [];
    skinContainer.innerHTML = skinTones.map(c =>
      `<button class="color-btn ${c === data.skin_tone ? 'selected' : ''}" data-color="${c}" style="background:${c}" onclick="UI.selectSkinTone('${c}')"></button>`
    ).join('');

    // Render equipped items
    const equippedEl = document.getElementById('equipped-items');
    const slots = ['hair', 'top', 'bottom', 'shoes', 'accessory'];
    equippedEl.innerHTML = slots.map(slot => {
      const item = (data.equipped || []).find(e => e.slot === slot);
      return `<div class="equipped-slot">
        <span class="slot-label">${slot}</span>
        <span class="slot-item">${item ? item.name : '(empty)'}</span>
      </div>`;
    }).join('');
  },

  selectHairColor(color) {
    document.querySelectorAll('#hair-color-options .color-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`#hair-color-options [data-color="${color}"]`)?.classList.add('selected');
  },

  selectSkinTone(color) {
    document.querySelectorAll('#skin-tone-options .color-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`#skin-tone-options [data-color="${color}"]`)?.classList.add('selected');
  },

  async saveAvatar() {
    if (this.isGuest) return;
    const bodyType = document.querySelector('#body-type-options .av-opt.active')?.dataset.value;
    const hairColor = document.querySelector('#hair-color-options .color-btn.selected')?.dataset.color;
    const skinTone = document.querySelector('#skin-tone-options .color-btn.selected')?.dataset.color;

    const body = {};
    if (bodyType) body.bodyType = bodyType;
    if (hairColor) body.hairColor = hairColor;
    if (skinTone) body.skinTone = skinTone;

    try {
      const method = this.avatarData?.id ? 'PUT' : 'POST';
      const res = await fetch('/api/avatars/me', {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        this.avatarData = data;
        this.renderAvatarEditor(data);
      }
    } catch (e) {}
  },

  // ─── SHOP ──────────────────────────────────────────────────────
  setupShop() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.loadShopCategory(tab.dataset.cat);
      });
    });
  },

  async openShop() {
    document.getElementById('shop-modal').classList.remove('hidden');
    this.loadShopCategory('hair');
  },

  async loadShopCategory(category) {
    try {
      const res = await fetch(`/api/avatars/shop?category=${category}`);
      const data = await res.json();
      this.renderShopItems(data.items || []);
    } catch (e) {}
  },

  renderShopItems(items) {
    const container = document.getElementById('shop-items');
    container.innerHTML = items.map(item => `
      <div class="shop-item ${item.price === 0 ? '' : 'premium-item'}">
        <div class="shop-item-name">${escapeHtml(item.name)}</div>
        <div class="shop-item-meta">
          <span class="shop-rarity rarity-${item.rarity}">${item.rarity}</span>
          <span class="shop-price">${item.price === 0 ? 'Free' : item.price + ' THB'}</span>
        </div>
        <button class="btn-small" onclick="UI.equipFromShop('${item.id}', '${item.category}')">Equip</button>
      </div>
    `).join('');
  },

  async equipFromShop(itemId, slot) {
    if (this.isGuest) return;
    try {
      const res = await fetch('/api/avatars/me/equip', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
        body: JSON.stringify({ itemId, slot })
      });
      if (res.ok) {
        const data = await res.json();
        this.avatarData = data;
        this.renderAvatarEditor(data);
      }
    } catch (e) {}
  },

  // ─── DATING ────────────────────────────────────────────────────
  setupDating() {
    document.getElementById('date-invite-btn')?.addEventListener('click', () => {
      if (this.isGuest) return;
      // Show invite modal for nearest matched player
      const nearest = window.ProfileCard?.closestPlayer;
      if (nearest?.userId) {
        this.inviteDate(nearest.userId);
      }
    });
  },

  async inviteDate(targetUserId) {
    if (this.isGuest || !targetUserId) return;
    const theme = prompt('Choose date theme: rooftop, beach, cafe, music_garden') || 'cafe';
    const validThemes = ['rooftop', 'beach', 'cafe', 'music_garden'];
    if (!validThemes.includes(theme)) {
      alert('Invalid theme');
      return;
    }
    try {
      const res = await fetch('/api/dating/invite/' + targetUserId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
        body: JSON.stringify({ theme })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Date invitation sent! Theme: ' + theme);
      } else {
        alert(data.error || 'Failed to send invite');
      }
    } catch (e) {
      alert('Network error');
    }
  },

  // ─── PROFILE FETCH ─────────────────────────────────────────────
  async fetchProfile() {
    const res = await fetch('/api/profiles/me', { headers: { 'Authorization': 'Bearer ' + this.token } });
    if (!res.ok) throw new Error('Failed to load profile');
    const data = await res.json();
    this.user = { id: data.user_id, nickname: data.nickname, email: data.email };
    return data;
  }
};

// Initialize UI when DOM ready
document.addEventListener('DOMContentLoaded', () => UI.init());
