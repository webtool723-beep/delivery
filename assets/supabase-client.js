// ============================================================
// RMS — Supabase Client
// assets/supabase-client.js
// ============================================================

// ← REPLACE WITH YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://bedvsnlhgkoloucoiwuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZHZzbmxoZ2tvbG91Y29pd3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDgzNzEsImV4cCI6MjA5MzM4NDM3MX0.92jGZGoKnsl8fcmYxBTTuZCWSBX0ND2bcNuoF1yO14s';

// Default branch ID for single-branch mode
window.DEFAULT_BRANCH_ID = '7d9b6af2-c169-4961-9529-a992041ab970';

// ============================================================
// Initialize Supabase client
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
});

window.supabaseClient = supabaseClient;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// ============================================================
// Get active branch ID
// Multi-branch: reads from localStorage
// Single-branch: returns DEFAULT_BRANCH_ID
// ============================================================
window.getActiveBranchId = function () {
  return localStorage.getItem('rms_active_branch') || window.DEFAULT_BRANCH_ID;
};

// ============================================================
// Connection health check
// ============================================================
let _heartbeatInterval = null;
let _isOnline = true;

window.startHeartbeat = function () {
  if (_heartbeatInterval) clearInterval(_heartbeatInterval);
  _heartbeatInterval = setInterval(async () => {
    try {
      const { error } = await supabaseClient
        .from('settings')
        .select('id')
        .limit(1);
      if (error) throw error;
      if (!_isOnline) {
        _isOnline = true;
        window.setConnectionStatus('online');
      }
    } catch {
      _isOnline = false;
      window.setConnectionStatus('offline');
    }
  }, 30000);
};

window.stopHeartbeat = function () {
  if (_heartbeatInterval) clearInterval(_heartbeatInterval);
};

// Override in each page to update UI
window.setConnectionStatus = function (status) {
  const banner = document.getElementById('offlineBanner');
  const dot = document.getElementById('liveDot');
  const liveText = document.getElementById('liveText');

  if (banner) {
    if (status === 'offline') {
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }

  if (dot) {
    dot.className = 'live-dot';
    if (status === 'offline') dot.classList.add('offline');
    if (status === 'reconnecting') dot.classList.add('reconnecting');
  }

  if (liveText) {
    if (status === 'online') liveText.textContent = 'Live';
    else if (status === 'reconnecting') liveText.textContent = 'Reconnecting…';
    else liveText.textContent = 'Local only';
  }
};

// Reconnect on tab visibility
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !_isOnline) {
    window.setConnectionStatus('reconnecting');
    setTimeout(async () => {
      try {
        const { error } = await supabaseClient.from('settings').select('id').limit(1);
        if (!error) {
          _isOnline = true;
          window.setConnectionStatus('online');
        }
      } catch { /* still offline */ }
    }, 1000);
  }
});

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
window.showToast = function (title, message = '', type = 'success', duration = 5000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  // Max 4 toasts
  while (container.children.length >= 4) {
    container.removeChild(container.firstChild);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', order: '🔔' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '✅'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-dismiss" onclick="this.closest('.toast').remove()">×</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ============================================================
// SETTINGS HELPERS
// ============================================================
window.getSetting = async function (key, branchId = null) {
  const bid = branchId || window.getActiveBranchId();
  const { data, error } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('branch_id', bid)
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value;
};

window.setSetting = async function (key, value, branchId = null) {
  const bid = branchId || window.getActiveBranchId();
  const { error } = await supabaseClient
    .from('settings')
    .upsert({ branch_id: bid, key, value }, { onConflict: 'branch_id,key' });
  return !error;
};

// ============================================================
// ORDER ID & INVOICE HELPERS
// ============================================================
window.generateOrderId = function (uuid) {
  return 'ORD-' + uuid.replace(/-/g, '').toUpperCase().slice(-6);
};

window.generateInvoiceNo = async function (branchId = null) {
  const bid = branchId || window.getActiveBranchId();
  const year = new Date().getFullYear();

  // Get today's date key
  const today = new Date().toISOString().split('T')[0];
  const counterKey = `invoice_counter_${today}`;

  const { data } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('branch_id', bid)
    .eq('key', counterKey)
    .maybeSingle();

  const currentCount = data ? parseInt(data.value || '0') : 0;
  const newCount = currentCount + 1;

  await supabaseClient
    .from('settings')
    .upsert({ branch_id: bid, key: counterKey, value: String(newCount) },
      { onConflict: 'branch_id,key' });

  return `INV-${year}-${String(newCount).padStart(4, '0')}`;
};

// ============================================================
// GST CALCULATOR
// ============================================================
window.calcGST = function (subtotal, ratePercent = 5) {
  const rate = parseFloat(ratePercent) || 5;
  const half = rate / 2;
  const cgst = parseFloat(((subtotal * half) / 100).toFixed(2));
  const sgst = parseFloat(((subtotal * half) / 100).toFixed(2));
  const total = parseFloat((subtotal + cgst + sgst).toFixed(2));
  return { cgst, sgst, total, rate };
};

// ============================================================
// DATE / TIME HELPERS (Indian locale)
// ============================================================
window.formatDateTime = function (dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

window.formatDate = function (dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric'
  });
};

window.formatTime = function (dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

window.todayIST = function () {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
};

// ============================================================
// ACTIVITY LOG
// ============================================================
window.logActivity = async function (eventType, description, staffName = '', branchId = null) {
  const bid = branchId || window.getActiveBranchId();
  await supabaseClient.from('activity_log').insert({
    branch_id: bid,
    event_type: eventType,
    description,
    staff_name: staffName
  });
};

// ============================================================
// PRINT BILL HELPER
// ============================================================
window.printBill = function (order, restaurantInfo = {}) {
  const slip = document.getElementById('printSlip');
  if (!slip) return;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const gstRate = parseFloat(restaurantInfo.gst_rate || 5);
  const half = gstRate / 2;

  let itemsHtml = '';
  items.forEach(it => {
    const lineTotal = (it.price * it.qty).toFixed(2);
    itemsHtml += `
      <tr>
        <td>${it.emoji || ''} ${it.name}</td>
        <td style="text-align:center">×${it.qty}</td>
        <td style="text-align:right">Rs. ${lineTotal}</td>
      </tr>`;
  });

  slip.innerHTML = `
    <div class="bill-restaurant">${restaurantInfo.restaurant_name || 'LAXMI'}</div>
    <div class="bill-address">${restaurantInfo.address || ''}</div>
    ${restaurantInfo.gstin ? `<div class="bill-address">GSTIN: ${restaurantInfo.gstin}</div>` : ''}
    <hr class="bill-divider">
    <div class="bill-row"><span>Invoice No:</span><span>${order.invoice_no || '—'}</span></div>
    <div class="bill-row"><span>Order ID:</span><span>${order.order_id}</span></div>
    <div class="bill-row"><span>Table No:</span><span>${order.table_number || '—'}</span></div>
    <div class="bill-row"><span>Mobile:</span><span>${order.customer_phone || '—'}</span></div>
    <div class="bill-row"><span>Date:</span><span>${window.formatDate(order.created_at)}</span></div>
    <div class="bill-row"><span>Time:</span><span>${window.formatTime(order.created_at)}</span></div>
    <div class="bill-row"><span>Status:</span><span>${order.status}</span></div>
    <hr class="bill-divider">
    <table class="bill-items" cellspacing="0">
      <thead><tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Amt</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr class="bill-divider">
    <div class="bill-row"><span>Subtotal:</span><span>Rs. ${parseFloat(order.subtotal).toFixed(2)}</span></div>
    <div class="bill-row"><span>CGST @ ${half}%:</span><span>Rs. ${parseFloat(order.cgst).toFixed(2)}</span></div>
    <div class="bill-row"><span>SGST @ ${half}%:</span><span>Rs. ${parseFloat(order.sgst).toFixed(2)}</span></div>
    <hr class="bill-divider">
    <div class="bill-row bill-total"><span>Grand Total:</span><span>Rs. ${parseFloat(order.total).toFixed(2)}</span></div>
    <hr class="bill-divider">
    <div class="bill-footer">Payment at counter · Thank you 🌿</div>
  `;

  window.print();
};

// ============================================================
// BROADCAST CHANNEL (same-browser fallback)
// ============================================================
window.rmsChannel = new BroadcastChannel('rms_orders');

console.log('✅ RMS Supabase client initialized');

