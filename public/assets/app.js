(() => {
  const store = {
    get token() { return localStorage.getItem('kindlink_token'); },
    set token(v) { v ? localStorage.setItem('kindlink_token', v) : localStorage.removeItem('kindlink_token'); },
    get user() {
      const raw = localStorage.getItem('kindlink_user');
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    },
    set user(v) { v ? localStorage.setItem('kindlink_user', JSON.stringify(v)) : localStorage.removeItem('kindlink_user'); },
  };

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function toast(msg, type = 'info') {
    const el = qs('#toast');
    if (!el) return alert(msg);
    el.textContent = msg;
    el.dataset.type = type;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && store.token) headers.Authorization = `Bearer ${store.token}`;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error || `HTTP ${res.status}`;
      throw new Error(err);
    }
    return data;
  }

  function formatDate(d) {
    try {
      const dt = new Date(d);
      return dt.toLocaleString();
    } catch { return String(d); }
  }

  function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'open') return '<span class="badge open">Open</span>';
    if (s === 'full') return '<span class="badge progress">Full</span>';
    if (s === 'in progress') return '<span class="badge progress">In Progress</span>';
    if (s.includes('progress')) return '<span class="badge progress">In Progress</span>';
    if (s.includes('completed')) return '<span class="badge done">Completed</span>';
    return `<span class="badge">${status || '-'}</span>`;
  }

  function requireLogin() {
    if (!store.token) {
      location.href = '/login.html';
      return false;
    }
    return true;
  }

  async function loadMe() {
    if (!store.token) return null;
    try {
      const r = await api('/api/auth/me');
      store.user = r.user;
      return r.user;
    } catch {
      store.token = null;
      store.user = null;
      return null;
    }
  }

  function renderTopbar() {
    const nav = qs('[data-nav]');
    const me = store.user;
    if (!nav) return;
    const base = `<a href="/index.html">Home</a>`;
    if (!store.token) {
      nav.innerHTML = base + `
        <a href="/login.html">Login</a>
        <a href="/register.html">Signup</a>
      `;
      return;
    }
    nav.innerHTML = base + `
      <a href="/dashboard.html" id="navDash">Dashboard</a>
      <a href="/browse-requests.html">Browse</a>
      <a href="/my-tasks.html">My Tasks</a>
      <a href="/history.html">History</a>
      <a href="/profile.html" style="display:inline-flex;align-items:center;gap:6px">
        ${me?.avatar ? `<img src="${me.avatar}" style="width:20px;height:20px;border-radius:50%;object-fit:cover">` : ''}
        Profile
      </a>
      ${me?.isAdmin ? `<a href="/admin.html">Admin</a>` : ``}
      <button type="button" id="logoutBtn">Logout</button>
    `;
    const btn = qs('#logoutBtn');
    btn?.addEventListener('click', () => {
      store.token = null;
      store.user = null;
      location.href = '/index.html';
    });

    // Live notification badge
    if (store.token) {
      api('/api/notifications').then(r => {
        const unread = (r.notifications || []).filter(x => !x.read).length;
        if (unread > 0) {
          const dashLink = qs('#navDash');
          if (dashLink) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = unread > 9 ? '9+' : String(unread);
            dashLink.style.position = 'relative';
            dashLink.appendChild(badge);
          }
        }
      }).catch(() => {});
    }
  }

  // ── Page context descriptions map ────────────────────────────────────────
  const PAGE_CTX = {
    home:          { label: 'Welcome',               desc: 'kindlink connects people who need help with volunteers nearby. Post a request, get matched, coordinate via chat, and leave feedback — all in one platform.' },
    dashboard:     { label: 'Your Dashboard',        desc: 'Your personal hub — monitor live stats, manage every request you posted, track tasks you accepted, and read notifications.' },
    browseRequests:{ label: 'Volunteer Opportunities',desc: 'These are real requests from people in your community who need help. Filter by urgency or category, see volunteer slots, and accept a task to start helping.' },
    postRequest:   { label: 'Post a Help Request',   desc: 'Describe what you need — grocery runs, medical transport, tutoring, elderely care, or anything else. Volunteers nearby will see your request and can accept it immediately.' },
    myTasks:       { label: 'Task Management',       desc: '"Requests I Posted" shows who is helping you. "Tasks I Accepted" shows tasks where you are the volunteer. Use this page to manage, delete, leave, or chat.' },
    taskDetails:   { label: 'Task Details',          desc: 'Full details of this task including status, accepted helper, and all available actions. Use the chat link to coordinate directly with the other party.' },
    requestDetails:{ label: 'Request Overview',      desc: 'See all volunteers who accepted this request, their individual task status, and jump into the shared group chat for coordination.' },
    chat:          { label: 'Group Chat',            desc: 'A shared message channel between the requester and all accepted volunteers. Coordinate details, share updates, and communicate in real time. All messages are saved.' },
    feedback:      { label: 'Leave Feedback',        desc: 'Rate your experience (1–5 stars) and write a comment. Feedback builds community trust — high-rated users are seen as more reliable by future volunteers and requesters.' },
    history:       { label: 'Completed History',     desc: 'A full record of tasks completed as both a requester and a volunteer. Use this to track your personal impact on the community over time.' },
    profile:       { label: 'Your Profile',          desc: 'Keep your profile current — your pincode determines which requests appear as "Nearby" on the Browse page. Update your name and location so others can find you.' },
    volunteerProfile:{ label: 'Public Profile',      desc: 'This is how other users see this volunteer. It shows their history, badges, and recent feedback from the community.' },
    complaint:     { label: 'File a Task Complaint', desc: 'Report issues tied to a specific task — volunteer no-shows, inappropriate behavior, or unresolved disputes. Only the admin can see and act on your report.' },
    generalComplaint:{ label: 'General Complaint',  desc: 'Report a platform-wide concern — bugs, policy issues, or anything not tied to a specific task. These reports go directly to the admin for review.' },
    myComplaints:  { label: 'My Complaints',         desc: 'Track the status of every complaint you have submitted. The admin will update the status once it has been reviewed and action has been taken.' },
    admin:         { label: 'Admin Control Panel',   desc: 'Admin-only area. Manage users, review all requests and feedback, handle complaints, ban bad actors, and monitor overall platform health.' },
    login:         { label: 'Sign In',               desc: 'Access your kindlink account to post requests, volunteer for tasks, and connect with your community. New here? Sign up — it is free.' },
    register:      { label: 'Create Account',        desc: 'Join kindlink to start helping others or get help from local volunteers. Fill in your pincode so we can show you the most relevant nearby requests.' },
  };

  function injectPageContext(pageName) {
    const ctx = PAGE_CTX[pageName];
    if (!ctx) return;
    const main = qs('main.container');
    if (!main || qs('.page-ctx')) return; // already injected
    const div = document.createElement('div');
    div.className = 'page-ctx';
    div.innerHTML = `<span class="page-ctx-label">${ctx.label}</span><span class="page-ctx-desc">${ctx.desc}</span>`;
    main.prepend(div);
  }

  // ── Chatbot widget ────────────────────────────────────────────────────────
  function initChatbot() {
    // Inject widget HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <button class="cb-btn" id="cbToggle" title="kindlink Assistant" aria-label="Open chatbot">KL?</button>
      <div class="cb-panel cb-hidden" id="cbPanel" role="dialog" aria-label="kindlink Assistant">
        <div class="cb-header">
          <div>
            <div class="cb-header-title">kindlink Assistant</div>
            <div class="cb-header-sub" id="cbSub">Loading...</div>
          </div>
          <button class="cb-close" id="cbClose" aria-label="Close">&times;</button>
        </div>
        <div class="cb-msgs" id="cbMsgs"></div>
        <div class="cb-qs" id="cbQs"></div>
        <div class="cb-input-row">
          <input class="cb-input" id="cbInput" placeholder="Ask anything about kindlink..." autocomplete="off" maxlength="300" />
          <button class="cb-send" id="cbSend">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    const toggle = qs('#cbToggle');
    const panel  = qs('#cbPanel');
    const msgs   = qs('#cbMsgs');
    const qsEl   = qs('#cbQs');
    const input  = qs('#cbInput');
    const send   = qs('#cbSend');
    const sub    = qs('#cbSub');
    let isOpen   = false;

    // Load FAQ questions from backend
    fetch('/api/chatbot/faq').then(r => r.json()).then(data => {
      const { questions = [], hasAI = false } = data;
      sub.textContent = hasAI ? 'Powered by Gemini AI' : 'FAQ Assistant';
      qsEl.innerHTML = questions.map(q =>
        `<button class="cb-q" data-q="${q}">${q}</button>`
      ).join('');
      qsa('.cb-q', qsEl).forEach(btn => {
        btn.addEventListener('click', () => sendMessage(btn.dataset.q));
      });
      // Welcome message
      appendMsg('bot', 'Hi! I am the kindlink assistant. Ask me anything about posting requests, volunteering, how chat works, or any other platform feature.', false);
    }).catch(() => {
      sub.textContent = 'FAQ Assistant';
      appendMsg('bot', 'Hi! Ask me about posting requests, volunteering, the chat system, urgency levels, or any other kindlink feature.', false);
    });

    function appendMsg(type, text, isAI = false) {
      const div = document.createElement('div');
      div.className = `cb-msg ${type}`;
      if (type === 'bot' && isAI) {
        div.innerHTML = `<span class="cb-ai-tag">Gemini AI</span>${text}`;
      } else {
        div.textContent = text;
      }
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      return div;
    }

    async function sendMessage(text) {
      if (!text.trim()) return;
      appendMsg('user', text);
      input.value = '';
      send.disabled = true;

      const typing = appendMsg('bot', 'Thinking...', false);
      typing.classList.add('typing');

      try {
        const res = await fetch('/api/chatbot/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}) },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        typing.remove();
        appendMsg('bot', data.answer || 'Sorry, I could not get an answer right now.', data.isAI);
      } catch {
        typing.remove();
        appendMsg('bot', 'Connection error. Please try again in a moment.');
      } finally {
        send.disabled = false;
        input.focus();
      }
    }

    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      panel.classList.toggle('cb-hidden', !isOpen);
      if (isOpen) {
        // re-trigger animation
        panel.classList.remove('cb-hidden');
        panel.style.animation = 'none';
        requestAnimationFrame(() => { panel.style.animation = ''; });
        input.focus();
      }
    });
    qs('#cbClose').addEventListener('click', () => { isOpen = false; panel.classList.add('cb-hidden'); });
    send.addEventListener('click', () => sendMessage(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(input.value.trim()); });
  }

  async function initCommon() {
    // Hide page loader immediately
    const loader = qs('#pageLoader');
    if (loader) setTimeout(() => loader.classList.add('hidden'), 80);

    await loadMe();
    renderTopbar();
    const who = qs('[data-who]');
    if (who) {
      who.textContent = store.user ? `${store.user.name}` : 'Guest';
    }

    // Theme logic
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌓';
    themeToggle.title = 'Toggle dark mode';
    themeToggle.onclick = () => {
      document.documentElement.classList.toggle('dark-mode');
      localStorage.setItem('kindlink-theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
    };
    const nav = qs('.nav');
    if (nav) nav.appendChild(themeToggle);

    if (localStorage.getItem('kindlink-theme') === 'dark' || (!localStorage.getItem('kindlink-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark-mode');
    }

    // Onboarding Wizard Overlay
    if (store.user && store.user.onboarded === false) {
      const ob = document.createElement('div');
      ob.className = 'onboarding-overlay';
      ob.innerHTML = `
        <div class="onboarding-card">
          <h2>Welcome to kindlink, ${store.user.name.split(' ')[0]}!</h2>
          <p class="muted">To match you with the right opportunities nearby, tell us what you're good at.</p>
          <div class="skills-grid">
            ${['Driving', 'Cooking', 'Teaching', 'Medical', 'Heavy Lifting', 'Tech Help', 'Pets', 'Listening'].map(s => 
              `<label><input type="checkbox" value="${s}" class="skill-checkbox"><span class="skill-label">${s}</span></label>`
            ).join('')}
          </div>
          <button class="btn primary" id="btnFinishOb" style="width:100%;margin-top:24px;">Start Exploring</button>
        </div>
      `;
      document.body.appendChild(ob);
      qs('#btnFinishOb').onclick = async () => {
        const skills = Array.from(ob.querySelectorAll('.skill-checkbox:checked')).map(cb => cb.value);
        await api('/api/auth/me', { method: 'PATCH', body: { onboarded: true, skills } });
        store.user.onboarded = true;
        store.user.skills = skills;
        ob.remove();
        toast('Profile setup complete!', 'ok');
      };
    }

    // Topbar scroll shadow
    window.addEventListener('scroll', () => {
      const topbar = qs('.topbar');
      if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    // Inject page context banner
    const page = document.body.dataset.page;
    if (page) injectPageContext(page);

    // Init chatbot on every page
    initChatbot();
  }


  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // Page inits
  const pages = {
    async home() {
      // Impact logic
      function animateValue(obj, start, end, duration) {
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const progress = Math.min((timestamp - startTimestamp) / duration, 1);
          obj.innerHTML = Math.floor(progress * (end - start) + start);
          if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
      }
      try {
        const data = await api('/api/stats', { auth: false });
        animateValue(qs('#statReq'), 0, data.totalRequests || 0, 1500);
        animateValue(qs('#statTasks'), 0, data.completedTasks || 0, 1500);
        animateValue(qs('#statVols'), 0, data.totalUsers || 0, 1500);
        animateValue(qs('#statHrs'), 0, data.volunteerHours || 0, 1500);
      } catch (err) {}
    },

    async login() {
      const form = qs('#loginForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = qs('#email').value;
        const password = qs('#password').value;
        try {
          const r = await api('/api/auth/login', { method: 'POST', auth: false, body: { email, password } });
          store.token = r.token;
          store.user = r.user;
          toast('Logged in', 'ok');
          if (r.user?.isAdmin) setTimeout(() => (location.href = '/admin.html'), 350);
          else setTimeout(() => (location.href = '/dashboard.html'), 350);
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async forgotPassword() {
      const form = qs('#forgotForm');
      const box = qs('#resetResult');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = qs('#email').value.trim();
        try {
          const r = await api('/api/auth/forgot', { method: 'POST', auth: false, body: { email } });
          toast('If the email exists, a reset link was generated.', 'ok');
          if (r.resetLink) {
            box.innerHTML = `
              <div class="card" style="margin-top:10px"><div class="card-body">
                <div class="pill">Demo reset link</div>
                <p style="margin-top:10px">Open this link to reset your password:</p>
                <div class="actions"><a class="btn primary" href="${r.resetLink}">Reset password</a></div>
                <p class="muted" style="margin-top:10px">In production, this would be emailed.</p>
              </div></div>
            `;
          } else {
            box.innerHTML = `<p class="muted" style="margin-top:10px">Reset link is not shown. Enable <b>DEMO_SHOW_RESET_LINK</b> to display it.</p>`;
          }
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async resetPassword() {
      const tokenFromUrl = getParam('token');
      const tokenEl = qs('#token');
      if (tokenFromUrl && tokenEl) tokenEl.value = tokenFromUrl;
      const form = qs('#resetForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = qs('#token').value.trim();
        const newPassword = qs('#newPassword').value;
        try {
          await api('/api/auth/reset', { method: 'POST', auth: false, body: { token, newPassword } });
          toast('Password reset. Please login.', 'ok');
          setTimeout(() => (location.href = '/login.html'), 700);
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async register() {
      const form = qs('#registerForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          name: qs('#name').value,
          email: qs('#email').value,
          password: qs('#password').value,
          location: qs('#location').value,
          pincode: qs('#pincode').value,
        };
        try {
          await api('/api/auth/register', { method: 'POST', auth: false, body });
          toast('Account created. Please login.', 'ok');
          setTimeout(() => (location.href = '/login.html'), 600);
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async dashboard() {
      if (!requireLogin()) return;
      if (store.user?.isAdmin) {
        location.replace('/admin.html');
        return;
      }

      // Personalised welcome
      const me = store.user;
      const welcomeEl = qs('#welcomeName');
      if (welcomeEl && me?.name) welcomeEl.textContent = `Welcome back, ${me.name}!`;

      const nBox    = qs('#notifications');
      const mineBox = qs('#myRequests');
      const tasksBox = qs('#myTasks');
      try {
        const [n, reqs, tasks] = await Promise.all([
          api('/api/notifications'),
          api('/api/requests/mine'),
          api('/api/tasks/mine'),
        ]);

        const allNotifs  = n.notifications || [];
        const allReqs    = reqs.requests   || [];
        const allTasks   = tasks.tasks     || [];
        const activeTasks    = allTasks.filter(t => t.status !== 'Completed');
        const completedCount = allTasks.filter(t => t.status === 'Completed').length;
        const unreadCount    = allNotifs.filter(x => !x.read).length;

        // ── Stats ──
        const sR = qs('#statsRequests');    if (sR) sR.textContent = allReqs.length;
        const sA = qs('#statsActiveTasks'); if (sA) sA.textContent = activeTasks.length;
        const sC = qs('#statsCompleted');   if (sC) sC.textContent = completedCount;
        const sN = qs('#statsNotifs');      if (sN) sN.textContent = unreadCount;

        // ── Notifications ──
        nBox.innerHTML = allNotifs.slice(0, 6).map(x => `
          <tr class="${x.read ? '' : 'unread-notification'}" style="cursor:pointer" data-notification-id="${x._id}">
            <td style="width:46px">${x.read ? '' : '<span class="pill" style="font-size:10px;padding:2px 7px">NEW</span>'}</td>
            <td>${x.message}</td>
            <td class="muted" style="white-space:nowrap;font-size:12px">${formatDate(x.createdAt)}</td>
          </tr>
        `).join('') || `<tr><td colspan="3" class="muted">No notifications yet</td></tr>`;

        // Add click handlers for marking notifications as read
        qsa('.unread-notification').forEach(row => {
          row.addEventListener('click', async () => {
            const notificationId = row.dataset.notificationId;
            try {
              await api(`/api/notifications/${notificationId}/read`, { method: 'POST' });
              // Update UI to mark as read
              row.classList.remove('unread-notification');
              const newPill = row.querySelector('.pill');
              if (newPill) newPill.remove();
              // Update unread count
              const unreadNotifs = allNotifs.filter(n => !n.read);
              const newCount = Math.max(0, unreadNotifs.length - 1);
              const sN = qs('#statsNotifs');
              if (sN) sN.textContent = newCount;
              // Update notification in array
              const notif = allNotifs.find(n => n._id === notificationId);
              if (notif) notif.read = true;
            } catch (err) {
              toast('Failed to mark as read', 'bad');
            }
          });
        });

        // ── Leaderboard ──────────────────────────────────────────────────
        try {
          const lbData = await api('/api/stats/leaderboard', { auth: false });
          const lbBox = qs('#leaderboardList');
          if (lbBox) {
            lbBox.innerHTML = lbData.leaderboard.map((lb, i) => `
              <div class="lb-row">
                <div class="lb-rank lb-rank-${i+1}">#${i+1}</div>
                <div class="lb-info">
                  <div>
                    <a href="/volunteer-profile.html?id=${lb.userId}" style="font-weight:700;text-decoration:none">${lb.name}</a>
                    ${lb.tier ? `<span class="tier-badge tier-${lb.tier}" style="margin-left:6px">${lb.tier}</span>` : ''}
                  </div>
                </div>
                <div class="lb-count">${lb.completedCount}</div>
              </div>
            `).join('') || '<div class="muted">No volunteers yet.</div>';
          }
        } catch {}

        // ── My Requests — now with View + Delete buttons ──
        mineBox.innerHTML = allReqs.slice(0, 6).map(r => {
          const acceptedCount = Array.isArray(r.acceptedBy) ? r.acceptedBy.length : 0;
          const canDelete = acceptedCount === 0 && String(r.status) !== 'Completed';
          return `
            <tr>
              <td>
                <div style="font-weight:700">${r.title}</div>
                <div class="muted" style="font-size:12px">${r.category} • ${r.location || '—'}</div>
              </td>
              <td>${statusBadge(r.status)}</td>
              <td class="muted" style="white-space:nowrap;font-size:12px">${formatDate(r.createdAt)}</td>
              <td style="white-space:nowrap">
                <a class="btn" href="/request-details.html?id=${r._id}">View</a>
                ${canDelete ? `<button class="btn bad" data-delreq="${r._id}">Delete</button>` : ''}
              </td>
            </tr>
          `;
        }).join('') || `<tr><td colspan="4" class="muted">No requests yet. <a href="/post-request.html">Post one now!</a></td></tr>`;

        // Delete handlers
        qsa('[data-delreq]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this request? This cannot be undone.')) return;
            try {
              btn.disabled = true;
              await api(`/api/requests/${encodeURIComponent(btn.dataset.delreq)}`, { method: 'DELETE' });
              toast('Request deleted', 'ok');
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              btn.disabled = false;
              toast(err.message, 'bad');
            }
          });
        });

        // ── Active Tasks — filter to only tasks where user is the helper ──
        const myId = String(store.user?._id || '');
        const helperTasks = activeTasks.filter(t => String(t.helperId) === myId);
        tasksBox.innerHTML = helperTasks.slice(0, 6).map(t => `
          <tr>
            <td>
              <div style="font-weight:700">${t.requestTitle || 'Task'}</div>
              <div class="muted" style="font-size:12px">Requester: ${t.otherUser?.name || '—'}</div>
            </td>
            <td>${statusBadge(t.status)}</td>
            <td style="white-space:nowrap">
              <a class="btn" href="/chat.html?requestId=${t.requestId}">Chat</a>
              <a class="btn" href="/task-details.html?id=${t._id}">Details</a>
            </td>
          </tr>
        `).join('') || `<tr><td colspan="3" class="muted">No active tasks. <a href="/browse-requests.html">Browse!</a></td></tr>`;
      } catch (err) {
        toast(err.message, 'bad');
      }
    },

    async profile() {
      if (!requireLogin()) return;
      const name = qs('#name');
      const email = qs('#email');
      const locationEl = qs('#location');
      const pincodeEl = qs('#pincode');
      const rating = qs('#rating');
      const skills = qs('#skills');
      const form = qs('#profileForm');

      const pTier = qs('#pTier');
      const pKarma = qs('#pKarma');
      const pBadges = qs('#pBadges');
      let currentAvatar = '';
      let originalAvatar = '';

      try {
        const r = await api(`/api/users/${store.user._id}`);
        const u = r.user;
        name.value = u.name || '';
        email.value = u.email || '';
        locationEl.value = u.location || '';
        pincodeEl.value = u.pincode || '';
        rating.value = u.rating ? `${u.rating.toFixed(2)} (${u.ratingCount || 0} reviews)` : 'No ratings yet';
        skills.value = Array.isArray(u.skills) ? u.skills.join(', ') : '';
        
        currentAvatar = u.avatar || '';
        originalAvatar = u.avatar || '';
        if (currentAvatar && qs('#avatarPreview')) {
          qs('#avatarPreview').src = currentAvatar;
        }

        const avatarInput = qs('#avatarInput');
        if (avatarInput) {
          avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 160;
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                const min = Math.min(img.width, img.height);
                const sx = (img.width - min) / 2;
                const sy = (img.height - min) / 2;
                ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
                currentAvatar = canvas.toDataURL('image/jpeg', 0.85);
                qs('#avatarPreview').src = currentAvatar;
              };
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          });
        }

        if (pTier) {
          if (u.tier) {
            pTier.innerHTML = `<span class="tier-badge tier-${u.tier}">${u.tier} Tier</span>`;
          } else {
            pTier.textContent = 'None yet (complete 1 task)';
          }
        }
        if (pKarma) pKarma.innerHTML = `<span class="karma-points">${u.karma || 0} ✨</span>`;
        if (pBadges) {
          if (u.badges && u.badges.length > 0) {
            pBadges.innerHTML = u.badges.map(b => `<span class="a-badge" title="${b.desc}">${b.label}</span>`).join('');
          } else {
            pBadges.innerHTML = '<span class="muted">No badges yet.</span>';
          }
        }
      } catch (err) {
        toast(err.message, 'bad');
      }

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const btn = qs('button[type="submit"]', form);
          btn.disabled = true;
          
          const skillsArr = skills.value.split(',').map(s=>s.trim()).filter(Boolean);
          const r = await api('/api/auth/me', {
            method: 'PATCH',
            body: {
              name: name.value,
              location: locationEl.value,
              pincode: pincodeEl.value,
              skills: skillsArr,
              avatar: currentAvatar && currentAvatar !== originalAvatar ? currentAvatar : undefined
            }
          });
          store.user = r.user;
          const who = qs('[data-who]');
          if (who) who.textContent = store.user.name;
          toast('Profile updated', 'ok');
          setTimeout(() => location.reload(), 1500);
        } catch (err) {
          const btn = qs('button[type="submit"]', form);
          if (btn) btn.disabled = false;
          toast(err.message, 'bad');
        }
      });
    },

    async postRequest() {
      if (!requireLogin()) return;

      const cloneData = sessionStorage.getItem('kindlink-clone');
      if (cloneData) {
        try {
          const d = JSON.parse(cloneData);
          if (d.title) qs('#title').value = d.title;
          if (d.dev) qs('#description').value = d.dev;
          if (d.cat) qs('#category').value = d.cat;
          if (d.loc) qs('#location').value = d.loc;
          if (d.pin) qs('#pincode').value = d.pin;
          if (d.urg) qs('#urgency').value = d.urg;
          if (d.vols) qs('#volunteersNeeded').value = d.vols;
          sessionStorage.removeItem('kindlink-clone');
        } catch {}
      }

      // Character counter
      const descEl = qs('#description');
      const countEl = qs('#descCount');
      if (descEl && countEl) {
        const max = Number(descEl.getAttribute('maxlength') || 600);
        function updateCount() {
          const rem = max - descEl.value.length;
          countEl.textContent = `${rem} characters remaining`;
          countEl.classList.toggle('warn', rem < 100);
          countEl.classList.toggle('bad',  rem < 20);
        }
        descEl.addEventListener('input', updateCount);
        updateCount();
      }

      const form = qs('#postRequestForm');
      const submitBtn = qs('#submitBtn');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const deadlineEl = qs('#deadline');
        const body = {
          title: qs('#title').value,
          description: qs('#description').value,
          category: qs('#category').value,
          location: qs('#location').value,
          pincode: qs('#pincode').value,
          volunteersNeeded: Number(qs('#volunteersNeeded').value),
          urgency: qs('#urgency').value,
          deadline: deadlineEl?.value || null,
        };
        try {
          if (submitBtn) { submitBtn.classList.add('loading'); submitBtn.disabled = true; }
          await api('/api/requests', { method: 'POST', body });
          toast('Request posted successfully', 'ok');
          setTimeout(() => (location.href = '/browse-requests.html'), 500);
        } catch (err) {
          if (submitBtn) { submitBtn.classList.remove('loading'); submitBtn.disabled = false; }
          toast(err.message, 'bad');
        }
      });
    },

    async browseRequests() {
      if (!requireLogin()) return;
      const nearbyTbody = qs('#nearbyRequests');
      const otherTbody  = qs('#otherRequests');
      const searchForm  = qs('#searchForm');
      const userPincode = String(store.user?.pincode || '').trim();

      if (!userPincode) {
        const existing = qs('#pincodeWarn');
        if (!existing) {
          const p = document.createElement('p');
          p.id = 'pincodeWarn'; p.className = 'muted'; p.style.marginTop = '10px';
          p.innerHTML = `Set your pincode in <a href="/profile.html">Profile</a> to see nearby requests first.`;
          searchForm?.parentElement?.prepend(p);
        }
      }

      function regionPrefix(v) {
        const s = String(v || '').trim();
        return s.length >= 3 ? s.slice(0, 3) : s;
      }

      function daysLeft(deadline) {
        if (!deadline) return null;
        const diff = Math.ceil((new Date(deadline) - Date.now()) / 86400000);
        return diff;
      }

      function renderRows(list) {
        return list.map(x => {
          const acceptedCount = Array.isArray(x.acceptedBy) ? x.acceptedBy.length : 0;
          const needed = Number(x.volunteersNeeded || 1);
          const fillPct = Math.min(100, Math.round((acceptedCount / needed) * 100));
          const isFull  = acceptedCount >= needed || String(x.status).toLowerCase() === 'full';
          const myId    = String(store.user?._id || '');
          const alreadyAccepted = myId && Array.isArray(x.acceptedBy) && x.acceptedBy.includes(myId);
          const isMine  = myId && String(x.postedBy) === myId;
          const disableAccept = isFull || alreadyAccepted || isMine;
          const label   = isFull ? 'Full' : (alreadyAccepted ? 'Accepted' : (isMine ? 'Mine' : 'Accept'));
          const urg     = String(x.urgency || 'Medium').toLowerCase();
          const urgClass = urg === 'high' ? 'high' : (urg === 'low' ? 'low' : 'medium');
          const dl = daysLeft(x.deadline);
          const deadlineHtml = dl !== null
            ? `<span class="deadline-tag ${dl <= 2 ? 'urgent' : ''}">${dl <= 0 ? 'Overdue' : dl === 1 ? '1 day left' : `${dl} days left`}</span>`
            : '';
          const isSOS = x.category === 'SOS / Emergency';
          const titleHtml = `<div style="font-weight:700" class="${isSOS ? 'urgency-high' : ''}">${x.title} ${deadlineHtml} ${x.pinned ? '📌' : ''}</div>`;
          const rowClass = `${isSOS ? 'req-SOS' : ''} ${x.pinned ? 'is-pinned' : ''} urgency-${urgClass}`;

          return `
            <tr class="${rowClass}">
              <td>
                ${titleHtml}
                <div class="muted" style="font-size:12px;margin-top:2px">${x.category} &bull; ${x.location || '&mdash;'} &bull; ${x.pincode || '&mdash;'}</div>
                <div class="muted" style="font-size:12px;margin-top:4px">${x.description.slice(0,100)}${x.description.length>100?'…':''}</div>
              </td>
              <td><span class="urgency-tag ${urgClass}">${x.urgency || 'Medium'}</span></td>
              <td>
                <div class="vol-bar">
                  <div class="vol-bar-track"><div class="vol-bar-fill" style="width:${fillPct}%"></div></div>
                  <div class="vol-bar-label">${acceptedCount} / ${needed}</div>
                </div>
              </td>
              <td>${statusBadge(isFull ? 'Full' : x.status)}</td>
              <td class="muted" style="font-size:12px;white-space:nowrap">${formatDate(x.createdAt)}</td>
              <td style="white-space:nowrap;display:flex;gap:4px;flex-direction:column;">
                <button class="btn ok" data-accept="${x._id}" ${disableAccept ? 'disabled' : ''}>${label}</button>
                <button class="btn" style="padding:4px 8px;font-size:10px" onclick="navigator.clipboard.writeText(location.origin+'/request-details.html?id=${x._id}').then(()=>alert('Link copied!'))">Share</button>
                <button class="btn bad" style="padding:4px 8px;font-size:10px" data-flag="${x._id}">Flag</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      function skeletonRows(n = 4, cols = 6) {
        return Array.from({length: n}, () =>
          `<tr class="skeleton-row">${Array.from({length: cols}, () =>
            `<td><div class="skeleton medium"></div></td>`).join('')}</tr>`
        ).join('');
      }

      async function load() {
        const q   = qs('#q')?.value.trim() || '';
        const urgF = qs('#filterUrgency')?.value || '';
        const catF = qs('#filterCategory')?.value || '';

        nearbyTbody.innerHTML = skeletonRows(3, 6);
        otherTbody.innerHTML  = skeletonRows(3, 6);

        try {
          const r = await api(`/api/requests?q=${encodeURIComponent(q)}`);
          let visible = (r.requests || []).filter(x =>
            String(x.status).toLowerCase() !== 'completed' &&
            String(x.status).toLowerCase() !== 'full'
          );
          if (urgF) visible = visible.filter(x => String(x.urgency||'Medium') === urgF);
          if (catF) visible = visible.filter(x => String(x.category||'') === catF);

          const nearby = [], others = [];
          visible.forEach(req => {
            const reqPin = String(req.pincode || '').trim();
            const near = userPincode && (reqPin === userPincode || regionPrefix(reqPin) === regionPrefix(userPincode));
            if (near) nearby.push(req); else others.push(req);
          });

          nearbyTbody.innerHTML = nearby.length ? renderRows(nearby)
            : `<tr><td colspan="6" class="muted">No nearby requests matching your filters.</td></tr>`;
          otherTbody.innerHTML = others.length ? renderRows(others)
            : `<tr><td colspan="6" class="muted">No other requests matching your filters.</td></tr>`;

          qsa('[data-accept]').forEach(btn => {
            btn.addEventListener('click', async () => {
              try {
                const note = prompt('Optional: Any availability note? (e.g. "Available Sat 2pm")\nPress OK to skip.');
                if (note === null) return; // User cancelled
                btn.disabled = true;
                btn.classList.add('loading');
                await api(`/api/requests/${btn.dataset.accept}/accept`, { method: 'POST', body: { availabilityNote: note } });
                toast('Task accepted! You can now see it in My Tasks and chat with the requester.', 'ok');
                setTimeout(() => (location.href = '/my-tasks.html'), 800);
              } catch (err) {
                btn.disabled = false;
                btn.classList.remove('loading');
                toast(err.message, 'bad');
              }
            });
          });

          qsa('[data-flag]').forEach(btn => {
            btn.addEventListener('click', async () => {
              if (!confirm('Flag this request as suspicious or inappropriate?')) return;
              try {
                const res = await api(`/api/requests/${btn.dataset.flag}/flag`, { method: 'POST' });
                toast(res.autoHidden ? 'Request hidden automatically.' : 'Request flagged.', 'ok');
                if (res.autoHidden) location.reload();
              } catch (err) {
                toast(err.message, 'bad');
              }
            });
          });
        } catch (err) {
          nearbyTbody.innerHTML = `<tr><td colspan="6" class="muted">${err.message}</td></tr>`;
          otherTbody.innerHTML  = `<tr><td colspan="6" class="muted"></td></tr>`;
        }
      }

      searchForm?.addEventListener('submit', (e) => { e.preventDefault(); load(); });
      qs('#filterUrgency')?.addEventListener('change', load);
      qs('#filterCategory')?.addEventListener('change', load);
      await load();
    },

    async myTasks() {
      if (!requireLogin()) return;
      try {
        const [reqs, tasks] = await Promise.all([
          api('/api/requests/mine'),
          api('/api/tasks/mine'),
        ]);

        const postedTbody = qs('#postedTbody');
        const acceptedTbody = qs('#acceptedTbody');

        postedTbody.innerHTML = (reqs.requests || []).map(r => {
          const acceptedCount = Array.isArray(r.acceptedBy) ? r.acceptedBy.length : 0;
          const needed = Number(r.volunteersNeeded || 1);
          // Only allow deletion if NO volunteer has accepted yet and the task isn't completed
          const canDelete = acceptedCount === 0 && String(r.status) !== 'Completed';
          return `
          <tr>
            <td>
              <div style="font-weight:800">${r.title}</div>
              <div class="muted">${r.category} • ${r.location || '—'} • ${r.pincode || '—'} • Needed: ${Number(r.volunteersNeeded || 1)} • Accepted: ${Array.isArray(r.acceptedBy) ? r.acceptedBy.length : 0}</div>
            </td>
            <td>${statusBadge(r.status)}</td>
            <td class="muted">${formatDate(r.createdAt)}</td>
            <td>
              <a class="btn" href="/request-details.html?id=${r._id}">View</a>
              <button class="btn ok" data-clone="${r._id}">Clone</button>
              ${canDelete ? `<button class="btn bad" data-delreq="${r._id}">Delete</button>` : ``}
            </td>
          </tr>
        `; }).join('') || `<tr><td colspan="4" class="muted">No posted requests</td></tr>`;

        qsa('[data-delreq]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this request? This cannot be undone.')) return;
            const id = btn.dataset.delreq;
            try {
              btn.disabled = true;
              await api(`/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
              toast('Request deleted', 'ok');
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              btn.disabled = false;
              toast(err.message, 'bad');
            }
          });
        });

        qsa('[data-clone]').forEach(btn => {
          btn.addEventListener('click', () => {
            const req = reqs.requests.find(x => x._id === btn.dataset.clone);
            if (!req) return;
            sessionStorage.setItem('kindlink-clone', JSON.stringify({
              title: req.title, dev: req.description, cat: req.category,
              loc: req.location, pin: req.pincode, urg: req.urgency, vols: req.volunteersNeeded
            }));
            location.href = '/post-request.html';
          });
        });

        const myId = String(store.user?._id || '');
        const accepted = (tasks.tasks || []).filter(t => String(t.helperId) === myId);

        if (accepted.length === 0) {
          acceptedTbody.innerHTML = `<tr><td colspan="4" class="muted">No tasks accepted yet. <a href="/browse-requests.html">Browse requests!</a></td></tr>`;
        } else {
          acceptedTbody.innerHTML = accepted.map(t => {
            const requesterInfo = t.otherUser
              ? `${t.otherUser.name} (${t.otherUser.email})`
              : (t.requesterId ? `...${String(t.requesterId).slice(-6)}` : '—');
            const isCompleted = t.status === 'Completed';
            return `
            <tr>
              <td>
                <div style="font-weight:800">${t.requestTitle || '(Untitled Request)'}</div>
                <div class="muted" style="font-size:12px">Requester: ${requesterInfo}</div>
              </td>
              <td>${statusBadge(t.status)}</td>
              <td class="muted" style="font-size:12px">${formatDate(t.acceptedAt)}</td>
              <td style="white-space:nowrap">
                <a class="btn" href="/chat.html?requestId=${t.requestId}">Chat</a>
                <a class="btn" href="/task-details.html?id=${t._id}">Details</a>
                ${!isCompleted ? `<button class="btn ok" data-complete-task="${t._id}">Mark Complete</button>` : ''}
                ${!isCompleted ? `<button class="btn bad" data-leave="${t.requestId}">Leave</button>` : ''}
              </td>
            </tr>
          `;
          }).join('');
        }

        // Complete task handler
        qsa('[data-complete-task]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Mark this task as completed?')) return;
            const taskId = btn.dataset.completeTask;
            try {
              btn.disabled = true;
              await api(`/api/tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST' });
              toast('Task marked as completed! Please leave feedback.', 'ok');
              setTimeout(() => location.reload(), 700);
            } catch (err) {
              btn.disabled = false;
              toast(err.message, 'bad');
            }
          });
        });

        qsa('[data-leave]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Leave this request? Your task will be removed and the request will go back to Browse.')) return;
            const requestId = btn.dataset.leave;
            try {
              btn.disabled = true;
              await api(`/api/requests/${encodeURIComponent(requestId)}/leave`, { method: 'POST' });
              toast('You have left the request. It is now available in Browse again.', 'ok');
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              btn.disabled = false;
              toast(err.message, 'bad');
            }
          });
        });
      } catch (err) {
        toast(err.message, 'bad');
      }
    },

    async requestDetails() {
      if (!requireLogin()) return;
      const id = getParam('id');
      if (!id) { toast('Missing request id', 'bad'); return; }
      const requestBox = qs('#requestBox');
      const helpersBox = qs('#helpersBox');
      try {
        const r = await api(`/api/requests/${encodeURIComponent(id)}`);
        const req = r.request;
        const tasks = r.tasks || [];
        const helpers = r.helpers || [];
        const acceptedCount = Array.isArray(req.acceptedBy) ? req.acceptedBy.length : 0;
        const needed = Number(req.volunteersNeeded || 1);
        
        // Fetch user details for helpers
        // Helpers are shown as anonymous IDs (privacy by design).
        requestBox.innerHTML = `
          <div class="pill">Request</div>
          <h2 style="margin-top:10px">${req.title}</h2>
          <p>${req.description}</p>
          <div class="row" style="margin-top:12px">
            <div class="card"><div class="card-body">
              <h3>Status</h3>
              <div style="margin-top:6px">${statusBadge(req.status)}</div>
            </div></div>
            <div class="card"><div class="card-body">
              <h3>Location</h3>
              <div class="muted" style="margin-top:6px">${req.location || '—'} • ${req.pincode || '—'}</div>
            </div></div>
          </div>
          <div class="row" style="margin-top:12px">
            <div class="card"><div class="card-body">
              <h3>Volunteers</h3>
              <div class="muted" style="margin-top:6px">Needed: ${needed} • Accepted: ${acceptedCount}</div>
            </div></div>
            <div class="card"><div class="card-body">
              <h3>Created</h3>
              <div class="muted" style="margin-top:6px">${formatDate(req.createdAt)}</div>
            </div></div>
          </div>
        `;

        const acceptedBy = Array.isArray(req.acceptedBy) ? req.acceptedBy : [];
        const taskByHelperId = new Map(tasks.map(t => [String(t.helperId), t]));

        const helpersToShow = acceptedBy.length ? acceptedBy : tasks.map(t => String(t.helperId));
        const helperById = new Map(helpers.map(h => [String(h._id), h]));

        helpersBox.innerHTML = helpersToShow.length > 0 ? `
          <table class="table">
            <thead><tr><th>Helper</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${helpersToShow.map(helperId => {
                const t = taskByHelperId.get(String(helperId));
                const status = t?.status || (String(req.status).toLowerCase() === 'full' || String(req.status).toLowerCase() === 'in progress' ? 'Accepted' : '—');
                const h = helperById.get(String(helperId));
                const helperLabel = h?.email ? `${h.email} (${h.name || 'User'}) • Rating: ${h.rating ?? 0}` : `Helper ${String(helperId).slice(-6)}`;
                const taskLink = t?._id
                  ? `<a class="btn" href="/task-details.html?id=${t._id}">Task</a> <a class="btn primary" href="/chat.html?requestId=${t.requestId}">Chat</a>`
                  : `<span class="muted">Pending task</span>`;
                return `
                  <tr>
                    <td class="muted">${helperLabel}</td>
                    <td>${statusBadge(status)}</td>
                    <td>${taskLink}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : `<p class="muted">No helpers yet.</p>`;

        // Add chat button if user is requester or has accepted the request
        const myId = store.user?._id;
        const isRequester = myId && String(req.postedBy) === String(myId);
        const hasAccepted = myId && Array.isArray(req.acceptedBy) && req.acceptedBy.includes(String(myId));
        
        if (isRequester || hasAccepted) {
          helpersBox.innerHTML += `
            <div class="actions" style="margin-top:12px">
              <a class="btn primary" href="/chat.html?requestId=${req._id}">Open Request Chat</a>
            </div>
            <p class="muted" style="margin-top:10px">You can use Request Chat (group), or per-helper chat when a task exists.</p>
          `;
        }
      } catch (err) {
        toast(err.message, 'bad');
        requestBox.textContent = 'Failed to load.';
      }
    },

    async taskDetails() {
      if (!requireLogin()) return;
      const id = getParam('id');
      if (!id) { toast('Missing task id', 'bad'); return; }
      const box = qs('#detailsBox');
      const completeBtn = qs('#completeBtn');
      const complaintBtn = qs('#complaintBtn');
      try {
        const r = await api(`/api/tasks/${encodeURIComponent(id)}`);
        const t = r.task;
        const req = r.request;
        const acceptedCount = Array.isArray(req?.acceptedBy) ? req.acceptedBy.length : 0;
        const needed = Number(req?.volunteersNeeded || 1);
        box.innerHTML = `
          <div class="pill">Task</div>
          <h2 style="margin-top:10px">${req?.title || 'Request'}</h2>
          <p>${req?.description || ''}</p>
          <div class="row" style="margin-top:12px">
            <div class="card"><div class="card-body">
              <h3>Status</h3>
              <div style="margin-top:6px">${statusBadge(t.status)}</div>
            </div></div>
            <div class="card"><div class="card-body">
              <h3>Accepted</h3>
              <div class="muted" style="margin-top:6px">${formatDate(t.acceptedAt)}</div>
            </div></div>
          </div>
          <div class="row" style="margin-top:12px">
            <div class="card"><div class="card-body">
              <h3>Volunteers Needed</h3>
              <div class="muted" style="margin-top:6px">${needed}</div>
            </div></div>
            <div class="card"><div class="card-body">
              <h3>Accepted Helpers</h3>
              <div class="muted" style="margin-top:6px">${acceptedCount}</div>
            </div></div>
          </div>
          <div class="actions" style="margin-top:12px">
            <a class="btn primary" href="/chat.html?requestId=${t.requestId}">Open Chat</a>
            <a class="btn" href="/feedback.html?taskId=${t._id}">Give Feedback</a>
          </div>
          <form id="btnFb" style="margin-top:16px">
            <h3>Quick Feedback</h3>
            <input type="number" id="fbRating" min="1" max="5" placeholder="Rating (1-5)" required>
            <textarea id="fbComment" placeholder="Comment"></textarea>
            <button class="btn ok" type="submit">Submit feedback</button>
          </form>
        `;
        qs('#btnFb')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const rating = Number(qs('#fbRating').value);
          const comment = qs('#fbComment').value.trim();
          try {
            await api(`/api/feedback`, { method: 'POST', body: { taskId: id, rating, comment } });
            toast('Feedback saved. Thank you!', 'ok');
            setTimeout(() => location.reload(), 800);
          } catch (err) { toast(err.message, 'bad'); }
        });
        completeBtn.disabled = t.status !== 'In Progress';
        if (complaintBtn) complaintBtn.href = `/complaint.html?taskId=${encodeURIComponent(t._id)}`;
        completeBtn.addEventListener('click', async () => {
          try {
            completeBtn.disabled = true;
            await api(`/api/tasks/${encodeURIComponent(id)}/complete`, { method: 'POST' });
            toast('Marked completed', 'ok');
            setTimeout(() => location.reload(), 600);
          } catch (err) {
            toast(err.message, 'bad');
            completeBtn.disabled = false;
          }
        });
      } catch (err) {
        toast(err.message, 'bad');
      }
    },

    async volunteerProfile() {
      const id = getParam('id');
      if (!id) return;
      try {
        const r = await api(`/api/users/${id}/public`, { auth: false });
        const u = r.user;
        const hero = qs('#vHero');
        if (hero) {
          hero.innerHTML = `
            <div style="font-size:32px;font-weight:900;">${u.name}</div>
            <div class="muted" style="margin-top:4px;">${u.location || 'Unknown location'} &bull; ${r.tier ? `<span class="tier-badge tier-${r.tier}">${r.tier} Tier</span>` : `${r.completedTasks} tasks done`}</div>
            <div style="font-size:24px;margin-top:16px;">
              ${u.rating ? `<span style="color:#f59e0b">★</span> ${u.rating.toFixed(1)}` : '<span class="muted">New</span>'}
              <span style="border-left:1px solid var(--border);margin:0 12px;padding-left:12px">
                <span class="karma-points">${r.karma} ✨ Karma</span>
              </span>
            </div>
          `;
        }

        const vSkills = qs('#vSkills');
        if (vSkills) {
          vSkills.innerHTML = (r.skills && r.skills.length)
            ? r.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')
            : '<span class="muted">No skills listed.</span>';
        }

        const vBadges = qs('#vBadges');
        if (vBadges) {
          vBadges.innerHTML = (r.badges && r.badges.length)
            ? r.badges.map(b => `<div class="a-badge" style="margin-bottom:8px;display:inline-flex" title="${b.desc}">${b.label}</div>`).join(' &nbsp; ')
            : '<span class="muted">No badges yet.</span>';
        }

        const rev = qs('#vReviews');
        if (rev) {
          rev.innerHTML = (r.reviews && r.reviews.length)
            ? r.reviews.map(fb => `
              <div style="margin-bottom:12px;padding:12px;background:var(--panel2);border-radius:12px;">
                <div style="font-weight:700;color:#f59e0b">★ ${fb.rating}</div>
                <div style="margin-top:4px;font-size:13px">${fb.comment || '<i>No comment left</i>'}</div>
              </div>
            `).join('')
            : '<span class="muted">No recent reviews.</span>';
        }
      } catch (err) {
        const hero = qs('#vHero');
        if (hero) hero.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
      }
    },

    async complaint() {
      if (!requireLogin()) return;
      const taskIdParam = getParam('taskId');
      const taskIdEl = qs('#taskId');
      if (taskIdParam && taskIdEl) taskIdEl.value = taskIdParam;
      const form = qs('#complaintForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = qs('#taskId').value.trim();
        const reason = qs('#reason').value;
        try {
          await api('/api/complaints', { method: 'POST', body: { taskId, reason } });
          toast('Complaint submitted', 'ok');
          setTimeout(() => (location.href = '/my-complaints.html'), 700);
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async myComplaints() {
      if (!requireLogin()) return;
      const tbody = qs('#complaintsTbody');
      try {
        const r = await api('/api/complaints/mine');
        tbody.innerHTML = (r.complaints || []).map(c => {
          const againstUserText = c.againstUserUser
            ? `${c.againstUserUser.name} (${c.againstUserUser.email})`
            : 'Unknown user';
          return `
          <tr>
            <td>${statusBadge(c.status)}</td>
            <td class="muted">${String(c.taskId).slice(-6)}</td>
            <td class="muted">${String(c.reason).slice(0, 120)}</td>
            <td class="muted" style="font-size:12px">Against: ${againstUserText}</td>
            <td class="muted">${formatDate(c.createdAt)}</td>
          </tr>
        `;
        }).join('') || `<tr><td colspan="5" class="muted">No complaints yet</td></tr>`;
        
        // Update table header to include the new column
        if (r.complaints && r.complaints.length > 0) {
          const thead = qs('#complaintsTbody').previousElementSibling;
          if (thead && thead.tagName === 'THEAD') {
            thead.innerHTML = '<tr><th>Status</th><th>Task</th><th>Reason</th><th>Against User</th><th>Created</th></tr>';
          }
        }
      } catch (err) {
        toast(err.message, 'bad');
      }
    },

    async chat() {
      if (!requireLogin()) return;
      const taskId = getParam('taskId');
      const requestId = getParam('requestId');
      const chatId = taskId || requestId;
      const chatType = taskId ? 'task' : 'request';
      if (!chatId) { toast('Missing taskId or requestId', 'bad'); return; }

      const chatBox = qs('#chatBox');
      const form = qs('#chatForm');
      const input = qs('#message');
      const title = qs('#chatTitle');
      const meId = store.user?._id;
      let since = null;

      async function loadMeta() {
        try {
          let r;
          if (chatType === 'task') {
            r = await api(`/api/tasks/${encodeURIComponent(chatId)}`);
          } else {
            r = await api(`/api/requests/${encodeURIComponent(chatId)}`);
          }
          title.textContent = r.request?.title ? `Chat • ${r.request.title}` : 'Chat';
        } catch {
          title.textContent = 'Chat';
        }
      }

      function renderMsg(m) {
        const mine = meId && String(m.senderId) === String(meId);
        const senderLabel = mine ? 'You' : escapeHtml(m.senderName || 'User');
        return `
          <div class="msg ${mine ? 'me' : ''}">
            <div class="sender-name">${senderLabel}</div>
            <div class="bubble">
              <div>${escapeHtml(m.message)}</div>
              <div class="meta">${formatDate(m.timestamp)}</div>
            </div>
          </div>
        `;
      }

      function escapeHtml(s) {
        return String(s)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');
      }

      async function poll() {
        try {
          const url = since
            ? `/api/chat/${chatType}/${encodeURIComponent(chatId)}/messages?since=${encodeURIComponent(since)}`
            : `/api/chat/${chatType}/${encodeURIComponent(chatId)}/messages`;
          const r = await api(url);
          const msgs = r.messages || [];
          if (msgs.length) {
            chatBox.insertAdjacentHTML('beforeend', msgs.map(renderMsg).join(''));
            since = msgs[msgs.length - 1].timestamp;
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        } catch (err) {
          toast(err.message, 'bad');
        } finally {
          setTimeout(poll, 1600);
        }
      }

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        try {
          await api(`/api/chat/${chatType}/${encodeURIComponent(chatId)}/messages`, {
            method: 'POST',
            body: { message: msg },
          });
        } catch (err) {
          toast(err.message, 'bad');
        }
      });

      await loadMeta();
      await poll();
    },

    async feedback() {
      if (!requireLogin()) return;
      const taskId = getParam('taskId');
      if (taskId) qs('#taskId').value = taskId;
      const form = qs('#feedbackForm');
      const loadBtn = qs('#loadExisting');
      const listBox = qs('#feedbackListBox');

      async function loadExisting() {
        const id = qs('#taskId').value.trim();
        if (!id) return toast('Enter taskId', 'warn');
        try {
          const r = await api(`/api/feedback/task/${encodeURIComponent(id)}`);
          if (r.myFeedback) {
            qs('#rating').value = r.myFeedback.rating;
            qs('#comment').value = r.myFeedback.comment || '';
          }
          const all = r.feedback || [];
          listBox.innerHTML = all.length ? `
            <h3>Existing feedback</h3>
            <table class="table" style="margin-top:8px">
              <thead><tr><th>Rating</th><th>Comment</th><th>Given by</th><th>Against User</th><th>Created</th></tr></thead>
              <tbody>
                ${all.map(f => {
                  const givenByText = f.givenByUser
                    ? `${f.givenByUser.name} (${f.givenByUser.email})`
                    : 'Unknown user';
                  const againstUserText = f.againstUserUser
                    ? `${f.againstUserUser.name} (${f.againstUserUser.email})`
                    : 'Unknown user';
                  return `
                  <tr>
                    <td>${f.rating}</td>
                    <td class="muted">${f.comment || ''}</td>
                    <td class="muted" style="font-size:12px">${givenByText}</td>
                    <td class="muted" style="font-size:12px">${againstUserText}</td>
                    <td class="muted">${formatDate(f.createdAt)}</td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>
          ` : `<p class="muted">No feedback yet.</p>`;
          toast('Loaded feedback', 'ok');
        } catch (err) { toast(err.message, 'bad'); }
      }

      loadBtn?.addEventListener('click', loadExisting);

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          taskId: qs('#taskId').value.trim(),
          rating: Number(qs('#rating').value),
          comment: qs('#comment').value,
        };
        try {
          await api('/api/feedback', { method: 'POST', body });
          toast('Feedback submitted', 'ok');
          await loadExisting();
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async history() {
      if (!requireLogin()) return;
      const tbody = qs('#historyTbody');
      try {
        const r = await api('/api/tasks/history/completed');
        tbody.innerHTML = (r.tasks || []).map(t => `
          <tr>
            <td>${statusBadge(t.status)}</td>
            <td class="muted">${formatDate(t.completedAt || t.acceptedAt)}</td>
            <td>
              <a class="btn" href="/task-details.html?id=${t._id}">Details</a>
              <a class="btn" href="/feedback.html?taskId=${t._id}">Feedback</a>
              <a class="btn warn" href="/complaint.html?taskId=${t._id}">Complaint</a>
            </td>
          </tr>
        `).join('') || `<tr><td colspan="3" class="muted">No completed tasks yet</td></tr>`;
      } catch (err) {
        toast(err.message, 'bad');
      }
    },

    async admin() {
      if (!requireLogin()) return;
      if (!store.user?.isAdmin) {
        toast('Access denied', 'bad');
        setTimeout(() => location.replace('/dashboard.html'), 600);
        return;
      }
      const adminBox = qs('#adminBox');
      const seedForm = qs('#seedAdminForm');
      const complaintsList = qs('#complaintsList');
      const generalComplaintsList = qs('#generalComplaintsList');
      const flaggedList = qs('#flaggedList');
      const usersList = qs('#usersList');
      const requestsList = qs('#requestsList');
      const feedbackList = qs('#feedbackList');

      // Export CSV dropdown
      const exportBtn = qs('#btnExportCsv');
      const exportDropdown = qs('#exportDropdown');
      
      exportBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.style.display = exportDropdown.style.display === 'none' ? 'block' : 'none';
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        if (exportDropdown) exportDropdown.style.display = 'none';
      });
      
      // Handle export dropdown items
      qsa('.dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const exportType = item.dataset.export;
          if (exportType) {
            try {
              // Show loading state
              const originalText = exportBtn.textContent;
              exportBtn.textContent = 'Exporting...';
              exportBtn.disabled = true;
              
              // Make authenticated request
              const response = await fetch(`/api/admin/export/${exportType}`, {
                headers: {
                  'Authorization': `Bearer ${store.token}`,
                  'Content-Type': 'text/csv'
                }
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              
              // Get the CSV data
              const csvData = await response.text();
              
              // Create download link
              const blob = new Blob([csvData], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `kindlink-${exportType}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
              
              toast('Export downloaded successfully', 'ok');
            } catch (err) {
              toast('Export failed: ' + err.message, 'bad');
            } finally {
              // Reset button
              exportBtn.textContent = originalText;
              exportBtn.disabled = false;
              exportDropdown.style.display = 'none';
            }
          }
        });
      });
      
      // Add hover effect for dropdown items
      qsa('.dropdown-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = 'var(--panel2)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = 'transparent';
        });
      });

      // Broadcast form
      qs('#broadcastForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = qs('#broadcastMsg');
        try {
          qs('button[type="submit"]', e.target).disabled = true;
          const r = await api('/api/admin/broadcast', { method: 'POST', body: { message: msgEl.value } });
          toast(`Sent to ${r.sent} users`, 'ok');
          msgEl.value = '';
        } catch (err) {
          toast(err.message, 'bad');
        } finally {
          qs('button[type="submit"]', e.target).disabled = false;
        }
      });

      if (adminBox) {
        try {
          const r = await api('/api/admin/stats');
          adminBox.innerHTML = `
            <div class="row" style="margin-top:10px">
              <div><div style="font-size:20px;font-weight:800;color:var(--brand)">${r.totalUsers}</div><div class="muted">Users</div></div>
              <div><div style="font-size:20px;font-weight:800;color:var(--brand)">${r.totalRequests}</div><div class="muted">Requests</div></div>
              <div><div style="font-size:20px;font-weight:800;color:var(--ok)">${r.completedTasks}</div><div class="muted">Completed Tasks</div></div>
              <div><div style="font-size:20px;font-weight:800;color:var(--text)">${r.completionRate}%</div><div class="muted">Success Rate</div></div>
            </div>
          `;

          // Charts
          if (window.Chart) {
            new Chart(qs('#chartStatus'), {
              type: 'doughnut',
              data: {
                labels: r.byStatus.map(x=>x.status),
                datasets: [{ data: r.byStatus.map(x=>x.count), backgroundColor: ['#0ea5e9','#f59e0b','#10b981'] }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Task Status' } } }
            });
            new Chart(qs('#chartCat'), {
              type: 'pie',
              data: {
                labels: r.byCat.map(x=>x.category),
                datasets: [{ data: r.byCat.map(x=>x.count), backgroundColor: ['#f43f5e','#8b5cf6','#3b82f6','#10b981','#f59e0b','#64748b','#ec4899','#14b8a6'] }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Requests by Category' }, legend: { position: 'right' } } }
            });
            new Chart(qs('#chartDaily'), {
              type: 'line',
              data: {
                labels: r.daily.map(x=>x.date),
                datasets: [{ label: 'New Requests', data: r.daily.map(x=>x.count), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3 }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
            });
          }
        } catch (err) {
          adminBox.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      const cResp = await api('/api/admin/complaints/all').catch(()=>({ taskComplaints: [], generalComplaints: [] }));

      // Task complaints (admin-only view)
      if (complaintsList) {
        try {
          const rows = (cResp.complaints || []).map(c => {
            const againstUserText = c.againstUserUser
              ? `${c.againstUserUser.name} (${c.againstUserUser.email})`
              : 'Unknown user';
            const complainByText = c.complainByUser
              ? `${c.complainByUser.name} (${c.complainByUser.email})`
              : 'Unknown user';
            return `
            <tr>
              <td>${statusBadge(c.status)}</td>
              <td class="muted" style="font-size:12px">${String(c.taskId).slice(-6)}</td>
              <td class="muted" style="font-size:12px">By: ${complainByText}</td>
              <td class="muted" style="font-size:12px">Against: ${againstUserText}</td>
              <td class="muted">${String(c.reason).slice(0, 50)}</td>
              <td class="muted">${formatDate(c.createdAt)}</td>
              <td>${c.status === 'Resolved' ? '' : `<button class="btn ok" data-resolve="${c._id}">Resolve</button>`}</td>
            </tr>
          `;
          }).join('');
          complaintsList.innerHTML = `
            <table class="table">
              <thead><tr><th>Status</th><th>Task</th><th>Complained By</th><th>Against (Helper)</th><th>Reason</th><th>Created</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="7" class="muted">No task complaints</td></tr>`}</tbody>
            </table>
          `;
          qsa('[data-resolve]').forEach(b => b.addEventListener('click', async () => {
            try {
              b.disabled = true;
              await api(`/api/complaints/${encodeURIComponent(b.dataset.resolve)}/resolve`, { method: 'POST' });
              toast('Resolved', 'ok');
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              b.disabled = false;
              toast(err.message, 'bad');
            }
          }));
        } catch (err) {
          complaintsList.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      // General complaints (admin-only)
      if (generalComplaintsList) {
        try {
          const r = await api('/api/complaints/general/all');
          const rows = (r.complaints || []).map(c => {
            const complainByText = c.complainByUser
              ? `${c.complainByUser.name} (${c.complainByUser.email})`
              : 'Unknown user';
            return `
            <tr>
              <td>${statusBadge(c.status)}</td>
              <td class="muted" style="font-size:12px">${complainByText}</td>
              <td class="muted">${String(c.reason).slice(0, 120)}</td>
              <td class="muted">${formatDate(c.createdAt)}</td>
              <td>${c.status === 'Resolved' ? '' : `<button class="btn ok" data-gresolve="${c._id}">Resolve</button>`}</td>
            </tr>
          `;
          }).join('');
          generalComplaintsList.innerHTML = `
            <table class="table">
              <thead><tr><th>Status</th><th>By</th><th>Reason</th><th>Created</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="5" class="muted">No general complaints</td></tr>`}</tbody>
            </table>
          `;
          qsa('[data-gresolve]').forEach(b => b.addEventListener('click', async () => {
            try {
              b.disabled = true;
              await api(`/api/complaints/general/${encodeURIComponent(b.dataset.gresolve)}/resolve`, { method: 'POST' });
              toast('Resolved', 'ok');
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              b.disabled = false;
              toast(err.message, 'bad');
            }
          }));
        } catch (err) {
          generalComplaintsList.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      // Users list + ban toggle
      if (usersList) {
        try {
          const r = await api('/api/admin/users');
          const rows = (r.users || []).map(u => `
            <tr>
              <td style="font-weight:800">${u.name}</td>
              <td class="muted">${u.email}</td>
              <td class="muted">${u.pincode || '—'}</td>
              <td class="muted">${u.rating ?? 0}</td>
              <td>${u.isBanned ? '<span class="badge done">Banned</span>' : '<span class="badge open">Active</span>'}</td>
              <td><button class="btn ${u.isBanned ? 'ok' : 'bad'}" data-ban="${u._id}" data-banned="${u.isBanned ? '1' : '0'}">${u.isBanned ? 'Unban' : 'Ban'}</button></td>
            </tr>
          `).join('');
          usersList.innerHTML = `
            <table class="table">
              <thead><tr><th>Name</th><th>Email</th><th>Pincode</th><th>Rating</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="6" class="muted">No users</td></tr>`}</tbody>
            </table>
          `;
          qsa('[data-ban]').forEach(b => b.addEventListener('click', async () => {
            const id = b.dataset.ban;
            const currentlyBanned = b.dataset.banned === '1';
            try {
              b.disabled = true;
              await api(`/api/admin/users/${encodeURIComponent(id)}/ban`, { method: 'POST', body: { banned: !currentlyBanned } });
              toast('Updated', 'ok');
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              b.disabled = false;
              toast(err.message, 'bad');
            }
          }));
        } catch (err) {
          usersList.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      // Requests list
      if (requestsList) {
        try {
          const r = await api('/api/admin/requests');
          const rows = (r.requests || []).map(x => `
            <tr class="${x.pinned ? 'is-pinned' : ''}">
              <td style="font-weight:800">
                <button class="btn" data-pin="${x._id}" style="padding:4px;font-size:14px;background:none;border:none;box-shadow:none;color:${x.pinned?'var(--warn)':'var(--muted)'};cursor:pointer" title="${x.pinned ? 'Unpin' : 'Pin to top'}">📌</button>
                ${x.title}
              </td>
              <td>${statusBadge(x.status)}</td>
              <td class="muted">${x.pincode || '—'}</td>
              <td class="muted">Needed ${Number(x.volunteersNeeded || 1)} / Accepted ${Array.isArray(x.acceptedBy) ? x.acceptedBy.length : 0}</td>
              <td class="muted">${formatDate(x.createdAt)}</td>
            </tr>
          `).join('');
          requestsList.innerHTML = `
            <table class="table">
              <thead><tr><th>Title</th><th>Status</th><th>Pincode</th><th>Volunteers</th><th>Created</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="5" class="muted">No requests</td></tr>`}</tbody>
            </table>
          `;
          qsa('[data-pin]').forEach(b => b.addEventListener('click', async () => {
            try {
              b.disabled = true;
              await api(`/api/admin/requests/${b.dataset.pin}/pin`, { method: 'POST' });
              toast('Pin updated', 'ok');
              setTimeout(() => location.reload(), 400);
            } catch(e) { toast(e.message, 'bad'); b.disabled = false; }
          }));
        } catch (err) {
          requestsList.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      // Flagged List
      if (flaggedList) {
        try {
          const r = await api('/api/admin/flagged');
          const rows = (r.requests || []).map(x => `
            <tr>
              <td><span class="badge bad">Flagged</span></td>
              <td style="font-weight:800">${x.title}</td>
              <td class="muted">Flags: ${x.flaggedBy?.length || 0}</td>
              <td>
                <button class="btn ok" data-unflag="${x._id}">Clear Flags</button>
                <button class="btn bad" data-delreq="${x._id}">Delete</button>
              </td>
            </tr>
          `).join('');
          flaggedList.innerHTML = `
            <table class="table">
              <thead><tr><th>Status</th><th>Title</th><th>Flags</th><th>Actions</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="4" class="muted">No flagged requests currently</td></tr>`}</tbody>
            </table>
          `;
          qsa('[data-unflag]').forEach(b => b.addEventListener('click', async () => {
            // Admin unflag logic would go here if implemented on backend, 
            // for now just delete the request if bad or leave alone.
            toast('Unflag not implemented', 'warn');
          }));
          qsa('[data-delreq]').forEach(b => b.addEventListener('click', async () => {
             if (!confirm('Permanent delete?')) return;
             try {
                await api(`/api/requests/${b.dataset.delreq}`, { method: 'DELETE' });
                toast('Deleted', 'ok');
                setTimeout(()=>location.reload(), 600);
             } catch(e) { toast(e.message,'bad'); }
          }));
        } catch (err) {
          flaggedList.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      // Feedback overview
      if (feedbackList) {
        try {
          const r = await api('/api/admin/feedback');
          const s = r.summary || { count: 0, avg: 0 };
          const rows = (r.feedback || []).slice(0, 25).map(f => {
            const givenByText = f.givenByUser
              ? `${f.givenByUser.name} (${f.givenByUser.email})`
              : `ID: ...${String(f.givenBy || '').slice(-6)}`;
            return `
            <tr>
              <td class="muted">${String(f.taskId).slice(-6)}</td>
              <td>${f.rating}</td>
              <td class="muted">${String(f.comment || '').slice(0, 70)}</td>
              <td class="muted" style="font-size:12px">${givenByText}</td>
              <td class="muted">${formatDate(f.createdAt)}</td>
            </tr>
          `;
          }).join('');
          feedbackList.innerHTML = `
            <p class="muted">Total feedback: <b>${s.count}</b> • Avg rating: <b>${s.avg}</b></p>
            <table class="table" style="margin-top:10px">
              <thead><tr><th>Task</th><th>Rating</th><th>Comment</th><th>Given By</th><th>Created</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="5" class="muted">No feedback</td></tr>`}</tbody>
            </table>
          `;
        } catch (err) {
          feedbackList.innerHTML = `<p class="muted">${err.message}</p>`;
        }
      }

      seedForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = qs('#seedEmail').value.trim();
        const key = qs('#seedKey').value.trim();
        try {
          const res = await fetch('/api/seed-admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-seed-key': key,
            },
            body: JSON.stringify({ email }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          toast('User promoted to Admin. Re-login.', 'ok');
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async generalComplaint() {
      if (!requireLogin()) return;
      const form = qs('#generalComplaintForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = qs('#reason').value;
        try {
          await api('/api/complaints/general', { method: 'POST', body: { reason } });
          toast('Submitted for admin review', 'ok');
          setTimeout(() => (location.href = '/dashboard.html'), 700);
        } catch (err) {
          toast(err.message, 'bad');
        }
      });
    },

    async contact() {
      const form = qs('#contactForm');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        toast('Thanks! (Demo form — not stored)', 'ok');
        form.reset();
      });
    },
  };

  window.Kindlink = { api, toast, store, formatDate, statusBadge };
  
  // Add debug function for testing
  window.debugMyTasks = () => window.Kindlink.Pages.myTasks();
  
  // Add function to test debug endpoint
  window.debugAllTasks = async () => {
    try {
      const result = await api('/api/tasks/debug/all');
      console.log('=== All Tasks Debug Result ===');
      console.log('Current User ID:', result.currentUserId);
      console.log('Current User Email:', result.currentUserEmail);
      console.log('All Tasks:', result.allTasks);
      
      // Check if any tasks have current user as helper
      const myTasks = result.allTasks.filter(t => 
        t.helperId === result.currentUserId || t.requesterId === result.currentUserId
      );
      console.log('Tasks where user is involved:', myTasks);
      
      return result;
    } catch (err) {
      console.error('Debug endpoint error:', err);
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await initCommon();
    const page = document.body.dataset.page;
    if (page && pages[page]) pages[page]();
  });
})();

