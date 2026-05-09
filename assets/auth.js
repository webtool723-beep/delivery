// ============================================================
// RMS — Firebase Auth Module (Fixed v2)
// assets/auth.js
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── CONFIG (self-contained — no dependency on supabase-client.js)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD07A69fbw_fySq42i5HOBRxZTzfuFhzSg",
  authDomain: "laxmi-42c73.firebaseapp.com",
  projectId: "laxmi-42c73",
  storageBucket: "laxmi-42c73.firebasestorage.app",
  messagingSenderId: "408574438944",
  appId: "1:408574438944:web:da6ece33ab663870f41645"
};
const SUPABASE_URL = 'https://bedvsnlhgkoloucoiwuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZHZzbmxoZ2tvbG91Y29pd3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDgzNzEsImV4cCI6MjA5MzM4NDM3MX0.92jGZGoKnsl8fcmYxBTTuZCWSBX0ND2bcNuoF1yO14s';
const DEFAULT_BRANCH_ID = '7d9b6af2-c169-4961-9529-a992041ab970';

// ── INIT
const fbApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(fbApp);
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose globally
window.firebaseAuth = auth;
window.supabaseClient = sb;
window.DEFAULT_BRANCH_ID = DEFAULT_BRANCH_ID;
window.getActiveBranchId = () => localStorage.getItem('rms_active_branch') || DEFAULT_BRANCH_ID;

// ── ERROR MAP
const errorMap = {
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed.',
  'auth/popup-blocked': 'Popup blocked — allow popups for this site.',
  'auth/user-disabled': 'This account has been disabled.',
};
window.getAuthError = (code) => errorMap[code] || 'Something went wrong. Try again.';

// ── PAGE ROLES
const pageRoles = {
  'kitchen.html': ['superadmin', 'admin', 'manager', 'kitchen'],
  'admin.html': ['superadmin', 'admin'],
  'menu-manager.html': ['superadmin', 'admin', 'manager'],
  'staff.html': ['superadmin', 'admin'],
  'reports.html': ['superadmin', 'admin', 'manager'],
  'superadmin.html': ['superadmin'],
  'super-admin.html': ['superadmin'],
  'waiter.html': ['superadmin', 'admin', 'manager', 'waiter'],
  'payment-manager.html': ['superadmin', 'admin', 'manager', 'payment_manager'],
  'delivery.html': ['superadmin', 'admin', 'manager', 'kitchen', 'delivery_boy'],
};
const getCurrentPage = () => {
  let p = window.location.pathname.split('/').pop().split('?')[0];
  if (!p || p === '/') return 'index.html';
  if (!p.endsWith('.html')) p += '.html';
  return p;
};

// ── STAFF LOOKUP
async function lookupStaff(uid) {
  try {
    const { data, error } = await sb.from('staff').select('*')
      .eq('firebase_uid', uid).eq('is_active', true).maybeSingle();
    if (error) { console.error('Staff lookup:', error); return null; }
    return data;
  } catch (e) { console.error('Staff lookup exception:', e); return null; }
}

// ── TOAST (self-contained)
window.showToast = function (title, message = '', type = 'success', duration = 4500) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  while (c.children.length >= 4) c.removeChild(c.firstChild);
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', order: '🔔' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span>
    <div class="toast-body"><div class="toast-title">${title}</div>
    ${message ? `<div class="toast-msg">${message}</div>` : ''}</div>
    <button class="toast-dismiss" onclick="this.closest('.toast').remove()">×</button>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, duration);
};

// ── SETTINGS
window.getSetting = async (key, bid = null) => {
  const b = bid || window.getActiveBranchId();
  const { data } = await sb.from('settings').select('value').eq('branch_id', b).eq('key', key).maybeSingle();
  return data?.value ?? null;
};
window.setSetting = async (key, value, bid = null) => {
  const b = bid || window.getActiveBranchId();
  // 1. Fetch existing ID
  const { data: existing } = await sb.from('settings').select('id').eq('branch_id', b).eq('key', key).maybeSingle();
  const payload = { branch_id: b, key, value };
  if (existing) payload.id = existing.id;
  const { error } = await sb.from('settings').upsert(payload);
  return !error;
};

// ── Global settings listener — updates all pages when settings change
window.listenToSettings = function () {
  const bid = window.getActiveBranchId();
  sb.channel('global-settings-' + bid)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'settings',
      filter: `branch_id=eq.${bid}`
    }, (payload) => {
      const key = payload.new?.key;
      const value = payload.new?.value;
      if (!key) return;

      // Update cached settings
      if (!window.restaurantSettings) window.restaurantSettings = {};
      window.restaurantSettings[key] = value;

      // ── Restaurant name
      if (key === 'restaurant_name') {
        window.applyRestaurantName(value);
      }

      // ── Store open/close
      if (key === 'store_open') {
        const isOpen = value !== 'false';
        // Update store banner on index.html
        const banner = document.getElementById('storeBanner');
        if (banner) banner.classList.toggle('show', !isOpen);
        // Update kitchen toggle
        const toggle = document.getElementById('storeToggle');
        const label = document.getElementById('storeLabel');
        if (toggle) toggle.checked = isOpen;
        if (label) label.textContent = isOpen ? 'Store Open' : 'Store Closed';
        // Update settings form toggle
        const setToggle = document.getElementById('setStoreOpen');
        const setLabel = document.getElementById('setStoreLabel');
        if (setToggle) setToggle.checked = isOpen;
        if (setLabel) setLabel.textContent = isOpen ? 'Store Open' : 'Store Closed';
        // Show toast on kitchen page
        const page = window.location.pathname.split('/').pop();
        if (page === 'kitchen.html') {
          window.showToast(
            isOpen ? '🟢 Store is now Open' : '🔴 Store is now Closed',
            'Updated from Admin Panel', isOpen ? 'success' : 'warning'
          );
        }
      }

      // ── GST rate
      if (key === 'gst_rate') {
        window.gstRate = parseFloat(value);
      }

      // ── Notify page-level handler if exists
      if (typeof window.onSettingChanged === 'function') {
        window.onSettingChanged(key, value);
      }
    })
    .subscribe();
};

window.applyRestaurantName = function (name) {
  if (!name) return;

  // Title
  if (document.title.includes('—')) {
    document.title = name + ' — ' + document.title.split('—')[1].trim();
  } else {
    document.title = name;
  }

  // Generic logos
  document.querySelectorAll('.sidebar-logo-name, .logo-text, .modal-logo, .auth-logo, .bill-restaurant').forEach(el => {
    if (el.classList.contains('bill-restaurant') || el.classList.contains('auth-logo')) {
      el.textContent = name;
    } else {
      el.textContent = '🍃 ' + name;
    }
  });

  // Specific data binding
  document.querySelectorAll('[data-setting="restaurant_name"]').forEach(el => {
    el.textContent = name;
  });
};

window.fetchAndApplyGlobalSettings = async function () {
  const bid = window.getActiveBranchId();
  if (!bid) return;
  const { data } = await sb.from('settings').select('key,value').eq('branch_id', bid);
  if (!data) return;

  if (!window.restaurantSettings) window.restaurantSettings = {};
  data.forEach(r => window.restaurantSettings[r.key] = r.value);

  if (window.restaurantSettings.restaurant_name) {
    window.applyRestaurantName(window.restaurantSettings.restaurant_name);
  }
  if (window.restaurantSettings.gst_rate) {
    window.gstRate = parseFloat(window.restaurantSettings.gst_rate);
  }
};

// Immediately execute on load
window.fetchAndApplyGlobalSettings();

window.logActivity = async (eventType, desc, staffName = '', bid = null) => {
  const b = bid || window.getActiveBranchId();
  await sb.from('activity_log').insert({ branch_id: b, event_type: eventType, description: desc, staff_name: staffName });
};

// ── HEARTBEAT
let _hb = null;
window.startHeartbeat = () => {
  if (_hb) clearInterval(_hb);
  _hb = setInterval(async () => {
    try { await sb.from('settings').select('id').limit(1); window.setConnectionStatus('online'); }
    catch { window.setConnectionStatus('offline'); }
  }, 30000);
};
window.setConnectionStatus = (status) => {
  const banner = document.getElementById('offlineBanner');
  const dot = document.getElementById('liveDot');
  const txt = document.getElementById('liveText');
  if (banner) banner.classList.toggle('show', status === 'offline');
  if (dot) { dot.className = 'live-dot'; if (status !== 'online') dot.classList.add(status); }
  if (txt) txt.textContent = status === 'online' ? 'Live' : status === 'reconnecting' ? 'Reconnecting…' : 'Offline';
};

// ── HELPERS
window.formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
window.formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
window.todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
window.calcGST = (subtotal, rate = 5) => {
  const half = parseFloat(rate) / 2;
  const cgst = parseFloat(((subtotal * half) / 100).toFixed(2));
  const sgst = parseFloat(((subtotal * half) / 100).toFixed(2));
  return { cgst, sgst, total: parseFloat((subtotal + cgst + sgst).toFixed(2)) };
};
window.printBill = (order, info = {}) => {
  const finalInfo = window.restaurantSettings && window.restaurantSettings.restaurant_name ? window.restaurantSettings : info;
  const slip = document.getElementById('printSlip'); if (!slip) return;
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const half = parseFloat(finalInfo.gst_rate || 5) / 2;
  slip.innerHTML = `<div style="font-family:monospace;font-size:12px;color:#000;max-width:300px;margin:0 auto">
    <div style="font-size:18px;font-weight:700;text-align:center" class="bill-restaurant">${finalInfo.restaurant_name || 'LAXMI'}</div>
    <div style="text-align:center;font-size:11px">${finalInfo.address || ''}</div>
    ${finalInfo.gstin ? `<div style="text-align:center;font-size:11px;margin-top:2px">GSTIN: ${finalInfo.gstin}</div>` : ''}
    <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
    <div style="display:flex;justify-content:space-between"><span>Invoice:</span><span>${order.invoice_no || '—'}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Order:</span><span>${order.order_id}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Table:</span><span>${order.table_number || '—'}</span></div>
    <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
    <table width="100%" cellspacing="0">
      <tbody>${items.map(i => `<tr><td>${i.emoji || ''} ${i.name}</td><td style="text-align:center">×${i.qty}</td><td style="text-align:right">Rs. ${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}</tbody>
    </table>
    <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
    <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>Rs. ${parseFloat(order.subtotal).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>CGST @${half}%:</span><span>Rs. ${parseFloat(order.cgst).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>SGST @${half}%:</span><span>Rs. ${parseFloat(order.sgst).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px dashed #999;padding-top:6px;margin-top:6px"><span>Total:</span><span>Rs. ${parseFloat(order.total).toFixed(2)}</span></div>
    <div style="text-align:center;font-size:11px;margin-top:10px">Thank you! 🌿</div>
  </div>`;
  window.print();
};

// ── SIDEBAR UI
window.renderStaffUI = () => {
  const s = window.currentStaff; if (!s) return;
  const a = document.getElementById('sidebarAvatar');
  const n = document.getElementById('sidebarUserName');
  const r = document.getElementById('sidebarUserRole');
  if (a) a.textContent = (s.name || 'S')[0].toUpperCase();
  if (n) n.textContent = s.name || s.email;
  if (r) r.textContent = s.role;
};

// ── AUTH GATE HTML
window.buildAuthGate = (pageTitle = 'Staff Login') => {
  const gate = document.getElementById('authGate'); if (!gate) return;
  gate.innerHTML = `
    <div class="auth-box">
      <div class="auth-logo">🍃 LAXMI</div>
      <div class="auth-subtitle">${pageTitle}</div>
      <div class="auth-error" id="authError" style="display:none;"></div>
      <div class="auth-form">
        <div class="input-group">
          <label class="input-label">Email</label>
          <input type="email" id="authEmail" class="input" placeholder="staff@laxmi.com"
            onkeydown="if(event.key==='Enter')document.getElementById('authPass').focus()">
        </div>
        <div class="input-group">
          <label class="input-label">Password</label>
          <input type="password" id="authPass" class="input" placeholder="••••••••"
            onkeydown="if(event.key==='Enter')window.handleStaffLogin()">
        </div>
        <button class="btn btn-primary btn-lg w-full" id="loginBtn" onclick="window.handleStaffLogin()">
          Sign In
        </button>
        <div style="text-align:center;">
          <button onclick="window.handleForgotPassword()"
            style="background:none;border:none;color:var(--text-dim);font-size:0.82rem;cursor:pointer;text-decoration:underline;">
            Forgot password?
          </button>
        </div>
      </div>
    </div>`;
};

function showAuthGate() {
  const gate = document.getElementById('authGate'); if (!gate) return;
  if (!gate.innerHTML.trim()) window.buildAuthGate(document.title.replace('LAXMI — ', ''));
  gate.style.display = 'flex';
  const app = document.getElementById('appContent');
  if (app) app.style.display = 'none';
}
function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.style.display = 'none';
  const app = document.getElementById('appContent');
  if (app) app.style.display = '';
}
function showAccessDenied(msg) {
  document.body.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;
    justify-content:center;background:var(--bg);color:var(--text);font-family:var(--font-body);padding:20px;text-align:center;">
    <div style="font-size:3rem;margin-bottom:16px;">🔒</div>
    <h2 style="color:var(--red);margin-bottom:12px;">Access Denied</h2>
    <p style="color:var(--text-dim);max-width:360px;line-height:1.7;margin-bottom:28px;">${msg}</p>
    <button onclick="window.rmsSignOut()" style="background:var(--surface2);border:1px solid var(--border);
      color:var(--text);padding:10px 24px;border-radius:8px;cursor:pointer;">Sign Out</button>
  </div>`;
}
function showVerifyScreen(user) {
  const gate = document.getElementById('authGate'); if (!gate) return;
  gate.innerHTML = `<div class="auth-box" style="text-align:center;">
    <div style="font-size:2.5rem;margin-bottom:12px;">📧</div>
    <div class="auth-logo">LAXMI</div>
    <div class="auth-subtitle">Verify Your Email</div>
    <p style="color:var(--text-dim);font-size:0.875rem;margin-bottom:24px;line-height:1.7;">
      Check your inbox for a verification link sent to<br>
      <strong style="color:var(--text);">${user.email}</strong>
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn btn-primary w-full" onclick="window.rmsReloadAuth()">✅ I've Verified — Continue</button>
      <button class="btn btn-secondary w-full" onclick="window.rmsResendVerification()">📨 Resend Email</button>
      <button class="btn btn-ghost w-full" onclick="window.rmsSignOut()">⏏ Sign Out</button>
    </div>
    <div id="verifyMsg" style="margin-top:14px;font-size:0.82rem;color:var(--text-dim);"></div>
  </div>`;
  gate.style.display = 'flex';
}

// ── SIGN OUT
window.rmsSignOut = async () => {
  try { await signOut(auth); } catch (e) { }
  localStorage.removeItem('rms_active_branch');
  window.currentStaff = null;
  window.location.reload();
};
window.rmsReloadAuth = async () => {
  const u = auth.currentUser; if (!u) return;
  await u.reload();
  if (u.emailVerified) window.location.reload();
  else { const el = document.getElementById('verifyMsg'); if (el) el.textContent = '⚠️ Not verified yet. Check inbox.'; }
};
window.rmsResendVerification = async () => {
  const el = document.getElementById('verifyMsg');
  try { if (auth.currentUser) await sendEmailVerification(auth.currentUser); if (el) el.textContent = '✅ Sent!'; }
  catch (e) { if (el) el.textContent = '❌ Could not send. Try again.'; }
};

// ── STAFF LOGIN
window.handleStaffLogin = async () => {
  const email = document.getElementById('authEmail')?.value?.trim() || '';
  const pass = document.getElementById('authPass')?.value || '';
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('loginBtn');
  if (!email || !pass) {
    if (errEl) { errEl.textContent = 'Enter your email and password.'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    if (errEl) { errEl.textContent = window.getAuthError(e.code); errEl.style.display = 'block'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
};
window.handleForgotPassword = async () => {
  const email = document.getElementById('authEmail')?.value?.trim() || '';
  const errEl = document.getElementById('authError');
  if (!email) { if (errEl) { errEl.textContent = 'Enter your email first.'; errEl.style.display = 'block'; } return; }
  try { await sendPasswordResetEmail(auth, email); window.showToast('📧 Reset link sent', 'Check your inbox', 'success'); }
  catch (e) { if (errEl) { errEl.textContent = window.getAuthError(e.code); errEl.style.display = 'block'; } }
};

// ── BroadcastChannel
try { window.rmsChannel = new BroadcastChannel('rms_orders'); } catch (e) { }

// ── WAIT HELPER
const waitFor = (fn, timeout = 3000) => new Promise(resolve => {
  if (fn()) return resolve();
  const start = Date.now();
  const t = setInterval(() => {
    if (fn() || Date.now() - start > timeout) { clearInterval(t); resolve(); }
  }, 50);
});

// ════════════════════════════════════════════════════════════
// MAIN AUTH STATE LISTENER
// ════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  const page = getCurrentPage();
  const isPublic = page === 'index.html' || page === '' || page === 'index';

  // ── PUBLIC PAGE: let index.html handle everything itself
  if (isPublic) {
    window.currentFirebaseUser = user;
    await waitFor(() => typeof window.appInit === 'function');
    if (typeof window.appInit === 'function') window.appInit(user);
    return;
  }

  // ── STAFF PAGES ──

  // Not logged in → show login form
  if (!user) { showAuthGate(); return; }

  // Email not verified → show verify screen
  // (comment out next 2 lines if you want to skip email verification)
  if (!user.emailVerified) { showVerifyScreen(user); return; }

  // Look up staff record
  const staff = await lookupStaff(user.uid);
  if (!staff) {
    showAccessDenied(`No staff record for <strong>${user.email}</strong>.<br>Add yourself in Supabase → staff table.`);
    return;
  }

  // Check role permission
  const allowed = pageRoles[page];
  if (!allowed || !allowed.includes(staff.role)) {
    showAccessDenied(`Your role (<strong>${staff.role}</strong>) cannot access this page.`);
    return;
  }

  // ✅ Authorized
  window.currentFirebaseUser = user;
  window.currentStaff = {
    uid: user.uid,
    email: user.email,
    name: staff.name,
    role: staff.role,
    branch_id: staff.branch_id || DEFAULT_BRANCH_ID,
    staff_id: staff.id
  };

  if (staff.branch_id) localStorage.setItem('rms_active_branch', staff.branch_id);

  // Wait for page's appInit to be defined
  await waitFor(() => typeof window.appInit === 'function');

  hideAuthGate();

  if (typeof window.appInit === 'function') window.appInit();
  else console.error('❌ appInit still not defined — check page script');
});

console.log('✅ RMS Auth v2 loaded');

