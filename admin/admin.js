/* ============================================================
   MyPrivateClinic Admin — admin.js
   ============================================================ */

const MPC = {
  config: { supabaseUrl: '', supabaseKey: '' },
  supabase: null,
  currentModule: 'dashboard',
  currentSubTab: null,
  currentUser: null,

  // ── Init ────────────────────────────────────────────────────
  async init() {
    if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
      document.getElementById('pageContent').innerHTML = `
        <div class="settings-section">
          <h3>⚠️ Configuration Required</h3>
          <p class="text-muted" style="margin-bottom:12px">Please update <code style="background:var(--bg);padding:2px 6px;border-radius:4px;color:var(--gold)">config.js</code> with your Supabase project URL and anon key, then reload.</p>
          <a href="config.js" class="btn btn-secondary btn-sm">Open config.js</a>
        </div>`;
      return;
    }

    MPC.config.supabaseUrl = SUPABASE_URL;
    MPC.config.supabaseKey = SUPABASE_ANON_KEY;
    MPC.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Auth check
    const { data: { session } } = await MPC.supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    MPC.currentUser = session.user;
    const email = session.user.email || '';
    const initials = email.slice(0, 1).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = email.split('@')[0];

    // Auth state listener
    MPC.supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.href = 'login.html';
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-module]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.module;
        MPC.navigate(mod);
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarBackdrop').classList.remove('open');
      });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await MPC.supabase.auth.signOut();
      window.location.href = 'login.html';
    });

    // Mobile menu toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarBackdrop').classList.toggle('open');
    });
    document.getElementById('sidebarBackdrop').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarBackdrop').classList.remove('open');
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', MPC.ui.closeModal);
    document.getElementById('modalCancel').addEventListener('click', MPC.ui.closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalOverlay')) MPC.ui.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') MPC.ui.closeModal();
    });

    // Load initial module
    await MPC.navigate('dashboard');
  },

  // ── Navigate ─────────────────────────────────────────────────
  async navigate(module, subtab) {
    MPC.currentModule = module;
    MPC.currentSubTab = subtab || null;

    // Update nav active state
    document.querySelectorAll('.nav-item[data-module]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.module === module);
    });

    // Update page title
    const titles = {
      dashboard: 'Dashboard', crm: 'CRM', financials: 'Financials',
      compliance: 'Compliance', analytics: 'Analytics', marketing: 'Marketing Calendar',
      referrals: 'Referral Network', inventory: 'Inventory', team: 'Team',
      feedback: 'Feedback', goals: 'Goals', settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[module] || module;

    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading…</div>';

    try {
      await MPC.modules[module].render(subtab);
      MPC.ui.makeTablesResponsive();
    } catch (err) {
      content.innerHTML = `<div class="card"><p class="text-danger">Error loading module: ${err.message}</p></div>`;
      console.error(err);
    }
  },

  // ── DB helpers ───────────────────────────────────────────────
  db: {
    async getAll(table, order = 'created_at', ascending = false) {
      const { data, error } = await MPC.supabase.from(table).select('*').order(order, { ascending });
      if (error) throw error;
      return data || [];
    },
    async add(table, payload) {
      const { data, error } = await MPC.supabase.from(table).insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    async update(table, id, payload) {
      const { data, error } = await MPC.supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(table, id) {
      const { error } = await MPC.supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ── UI helpers ───────────────────────────────────────────────
  ui: {
    _onSave: null,

    showModal(title, content, onSave) {
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalBody').innerHTML = content;
      MPC.ui._onSave = onSave;
      document.getElementById('modalSave').onclick = async () => {
        const btn = document.getElementById('modalSave');
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          await MPC.ui._onSave();
          MPC.ui.closeModal();
        } catch (e) {
          MPC.ui.showToast(e.message || 'Save failed', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Save';
        }
      };
      document.getElementById('modalOverlay').classList.add('open');
      // Focus first input
      setTimeout(() => {
        const first = document.querySelector('#modalBody input, #modalBody select, #modalBody textarea');
        if (first) first.focus();
      }, 100);
    },

    closeModal() {
      document.getElementById('modalOverlay').classList.remove('open');
      MPC.ui._onSave = null;
    },

    makeTablesResponsive() {
      document.querySelectorAll('#pageContent table').forEach(table => {
        table.classList.add('responsive-table');
        const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach(row => {
          [...row.querySelectorAll('td')].forEach((td, i) => {
            if (headers[i]) td.setAttribute('data-label', headers[i]);
          });
        });
      });
    },

    showToast(message, type = 'success') {
      const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span class="toast-icon">${icons[type] || '•'}</span><span>${message}</span>`;
      document.getElementById('toast-container').appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'toastOut 0.2s ease forwards';
        setTimeout(() => toast.remove(), 200);
      }, 3500);
    },

    confirm(message, title = 'Confirm') {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
          <div class="confirm-box">
            <div class="confirm-icon">⚠️</div>
            <div class="confirm-title">${title}</div>
            <div class="confirm-msg">${message}</div>
            <div class="confirm-btns">
              <button class="btn btn-secondary" id="confirmNo">Cancel</button>
              <button class="btn btn-danger" id="confirmYes">Delete</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true); };
        overlay.querySelector('#confirmNo').onclick  = () => { overlay.remove(); resolve(false); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
      });
    }
  },

  // ── Formatters ───────────────────────────────────────────────
  fmt: {
    money(val) {
      const n = parseFloat(val) || 0;
      return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    date(val) {
      if (!val) return '—';
      const d = new Date(val);
      if (isNaN(d)) return val;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    stars(n) {
      const full = Math.round(n);
      return '★'.repeat(full) + '☆'.repeat(5 - full);
    },
    statusBadge(status) {
      const map = {
        'New': 'new', 'Contacted': 'contacted', 'Booked': 'booked',
        'Converted': 'converted', 'Lost': 'lost',
        'Active': 'active', 'Expired': 'expired', 'Due Soon': 'due-soon', 'Completed': 'completed',
        'Idea': 'idea', 'Drafting': 'drafting', 'Scheduled': 'scheduled', 'Published': 'published',
        'Aware': 'aware', 'Connected': 'connected', 'Engaged': 'engaged',
        'Meeting': 'meeting', 'Proposal': 'proposal', 'Client': 'client',
        'On Track': 'on-track', 'At Risk': 'at-risk', 'Missed': 'missed',
        'Low Stock': 'low-stock',
        'Yes': 'yes', 'No': 'no',
        'GP': 'gp', 'Consultant': 'consultant',
        'CQC': 'cqc', 'Insurance': 'insurance', 'DBS': 'dbs',
        'CPD': 'cpd', 'Policy': 'policy', 'Incident': 'incident',
        'Complaint': 'complaint', 'GMC': 'gmc'
      };
      const cls = map[status] || status.toLowerCase().replace(/\s+/g, '-');
      return `<span class="badge badge-${cls}">${status}</span>`;
    },
    daysUntil(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      const now = new Date();
      now.setHours(0,0,0,0);
      d.setHours(0,0,0,0);
      return Math.floor((d - now) / 86400000);
    }
  },

  // ── Services list ─────────────────────────────────────────────
  services: [
    'GP Consultation 15min — £69',
    'GP Consultation 30min — £120',
    "Children's Consultation — £49",
    "Women's Health — £120",
    "Men's Health — £120",
    'Blood Tests & Screening — £120',
    'Weight Loss Consultation — £120',
    'Allergy Testing — £120',
    'Sexual Health — £120',
    'Home Visit — £120',
    'Sick Note / Medical Report — £69',
    'Other'
  ],

  // ── MODULES ──────────────────────────────────────────────────
  modules: {

    // ── DASHBOARD ──────────────────────────────────────────────
    dashboard: {
      async render() {
        const [leads, transactions, compliance] = await Promise.all([
          MPC.db.getAll('leads'),
          MPC.db.getAll('transactions'),
          MPC.db.getAll('compliance_items')
        ]);

        // Stats
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart  = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());

        const leadsThisMonth = leads.filter(l => new Date(l.created_at) >= monthStart);

        const txThisWeek  = transactions.filter(t => new Date(t.date) >= weekStart);
        const txThisMonth = transactions.filter(t => new Date(t.date) >= monthStart);

        const revenueWeek  = txThisWeek.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
        const revenueMonth = txThisMonth.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const converted = leads.filter(l => l.status === 'Converted').length;
        const convRate  = leads.length ? Math.round((converted / leads.length) * 100) : 0;

        // Compliance alerts (expiring within 30 days)
        const alerts = compliance.filter(c => {
          const date = c.expiry_date || c.review_date;
          if (!date) return false;
          const days = MPC.fmt.daysUntil(date);
          return days !== null && days <= 30;
        });

        // Upcoming follow-ups (next 7 days)
        const upcoming = leads
          .filter(l => {
            if (!l.follow_up_date) return false;
            const days = MPC.fmt.daysUntil(l.follow_up_date);
            return days !== null && days <= 7;
          })
          .sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date))
          .slice(0, 5);

        const recentLeads = leads.slice(0, 5);

        document.getElementById('pageContent').innerHTML = `
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-icon">👥</span>
              <div class="stat-label">Leads This Month</div>
              <div class="stat-value">${leadsThisMonth.length}</div>
              <div class="stat-change">${leads.length} total</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">💷</span>
              <div class="stat-label">Revenue This Week</div>
              <div class="stat-value">${MPC.fmt.money(revenueWeek)}</div>
              <div class="stat-change">${txThisWeek.length} transactions</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">📈</span>
              <div class="stat-label">Revenue This Month</div>
              <div class="stat-value">${MPC.fmt.money(revenueMonth)}</div>
              <div class="stat-change">${txThisMonth.length} transactions</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">🎯</span>
              <div class="stat-label">Conversion Rate</div>
              <div class="stat-value">${convRate}%</div>
              <div class="stat-change">${converted} converted of ${leads.length}</div>
            </div>
          </div>

          <div class="quick-actions mb-24">
            <button class="btn btn-primary" onclick="MPC.modules.crm.openAddLead()">+ Add Lead</button>
            <button class="btn btn-secondary" onclick="MPC.modules.financials.openAddTransaction()">+ Add Transaction</button>
          </div>

          <div class="grid-2 mb-24">
            <div class="card">
              <div class="card-header">
                <span class="card-title">Recent Leads</span>
                <button class="btn btn-ghost btn-sm" onclick="MPC.navigate('crm')">View all →</button>
              </div>
              ${recentLeads.length === 0 ? '<p class="text-muted text-sm">No leads yet.</p>' : `
              <table class="mini-table">
                <thead><tr><th>Name</th><th>Source</th><th>Status</th></tr></thead>
                <tbody>
                  ${recentLeads.map(l => `
                    <tr>
                      <td><span class="fw-600">${l.name}</span></td>
                      <td><span class="text-muted text-sm">${l.source || '—'}</span></td>
                      <td>${MPC.fmt.statusBadge(l.status)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`}
            </div>

            <div class="card">
              <div class="card-header">
                <span class="card-title">Upcoming Follow-ups</span>
              </div>
              ${upcoming.length === 0
                ? '<p class="text-muted text-sm">No follow-ups in the next 7 days.</p>'
                : `<div class="followup-list">${upcoming.map(l => {
                    const days = MPC.fmt.daysUntil(l.follow_up_date);
                    const cls  = days < 0 ? 'followup-overdue' : '';
                    const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `In ${days}d`;
                    return `<div class="followup-item">
                      <span class="followup-name">${l.name}</span>
                      <span class="followup-date ${cls}">${label} — ${MPC.fmt.date(l.follow_up_date)}</span>
                    </div>`;
                  }).join('')}</div>`}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">Compliance Alerts</span>
              <button class="btn btn-ghost btn-sm" onclick="MPC.navigate('compliance')">View all →</button>
            </div>
            ${alerts.length === 0
              ? '<p class="text-muted text-sm">✓ No items expiring within 30 days.</p>'
              : `<div class="alert-list">${alerts.map(c => {
                  const date = c.expiry_date || c.review_date;
                  const days = MPC.fmt.daysUntil(date);
                  const cls  = days < 0 ? 'expired' : '';
                  return `<div class="alert-item ${cls}">
                    ${MPC.fmt.statusBadge(c.category)}
                    <span class="alert-text">${c.title}</span>
                    <span class="alert-date">${days < 0 ? 'Expired' : `${days}d`} — ${MPC.fmt.date(date)}</span>
                  </div>`;
                }).join('')}</div>`}
          </div>
        `;
      }
    },

    // ── CRM ─────────────────────────────────────────────────────
    crm: {
      async render(tab) {
        tab = tab || 'leads';
        MPC.currentSubTab = tab;
        const html = `
          <div class="subtabs">
            <button class="subtab${tab==='leads'?' active':''}" onclick="MPC.navigate('crm','leads')">Leads</button>
            <button class="subtab${tab==='corporate'?' active':''}" onclick="MPC.navigate('crm','corporate')">Corporate</button>
            <button class="subtab${tab==='referrers'?' active':''}" onclick="MPC.navigate('crm','referrers')">Referrers</button>
          </div>
          <div id="crmTabContent"></div>
        `;
        document.getElementById('pageContent').innerHTML = html;

        if (tab === 'leads')     await MPC.modules.crm.renderLeads();
        if (tab === 'corporate') await MPC.modules.crm.renderCorporate();
        if (tab === 'referrers') await MPC.modules.crm.renderReferrers();
      },

      async renderLeads() {
        const rows = await MPC.db.getAll('leads');
        document.getElementById('crmTabContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <input class="search-input" id="leadsSearch" placeholder="Search leads…" oninput="MPC.modules.crm.filterLeads(this.value)">
              <div class="table-filters">
                <select class="filter-select" id="leadStatusFilter" onchange="MPC.modules.crm.filterLeads()">
                  <option value="">All Statuses</option>
                  <option>New</option><option>Contacted</option><option>Booked</option>
                  <option>Converted</option><option>Lost</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="MPC.modules.crm.openAddLead()">+ Add Lead</button>
              </div>
            </div>
            <div id="leadsTableWrap">${MPC.modules.crm._leadsTable(rows)}</div>
          </div>`;
        MPC.modules.crm._leadsData = rows;
      },

      _leadsData: [],
      _leadsTable(rows) {
        if (!rows.length) return `<div class="table-empty"><span class="empty-icon">👥</span>No leads yet. Add your first lead.</div>`;
        return `<table><thead><tr>
          <th>Name</th><th>Phone</th><th>Source</th><th>Service Interest</th>
          <th>Status</th><th>Follow-up</th><th>Actions</th>
        </tr></thead><tbody>
          ${rows.map(l => `<tr>
            <td><span class="fw-600">${l.name}</span>${l.email ? `<br><span class="text-muted text-xs">${l.email}</span>` : ''}</td>
            <td>${l.phone || '—'}</td>
            <td>${l.source || '—'}</td>
            <td class="truncate">${l.service_interest || '—'}</td>
            <td>${MPC.fmt.statusBadge(l.status)}</td>
            <td>${MPC.fmt.date(l.follow_up_date)}</td>
            <td><div class="action-btns">
              <button class="btn btn-ghost btn-icon" title="Edit" onclick="MPC.modules.crm.editLead('${l.id}')">✏️</button>
              <button class="btn btn-ghost btn-icon" title="Delete" onclick="MPC.modules.crm.deleteLead('${l.id}')">🗑️</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table>`;
      },

      filterLeads(search) {
        const s = (search ?? document.getElementById('leadsSearch')?.value ?? '').toLowerCase();
        const st = document.getElementById('leadStatusFilter')?.value || '';
        const filtered = MPC.modules.crm._leadsData.filter(l => {
          const matchS = !s || l.name.toLowerCase().includes(s) || (l.phone||'').includes(s) || (l.email||'').toLowerCase().includes(s);
          const matchSt = !st || l.status === st;
          return matchS && matchSt;
        });
        document.getElementById('leadsTableWrap').innerHTML = MPC.modules.crm._leadsTable(filtered);
      },

      _leadForm(l = {}) {
        const svcOpts = MPC.services.map(s => `<option${l.service_interest===s?' selected':''}>${s}</option>`).join('');
        return `
          <div class="form-row">
            <div class="form-group"><label>Full Name *</label>
              <input class="form-control" id="fName" value="${l.name||''}" required placeholder="Jane Smith"></div>
            <div class="form-group"><label>Phone</label>
              <input class="form-control" id="fPhone" value="${l.phone||''}" placeholder="+44 7700 000000"></div>
          </div>
          <div class="form-group"><label>Email</label>
            <input class="form-control" id="fEmail" type="email" value="${l.email||''}" placeholder="jane@example.com"></div>
          <div class="form-row">
            <div class="form-group"><label>Source</label>
              <select class="form-control" id="fSource">
                ${['Leaflet/QR','WhatsApp','Phone','Website','Word of Mouth','LinkedIn','Google'].map(s=>`<option${l.source===s?' selected':''}>${s}</option>`).join('')}
              </select></div>
            <div class="form-group"><label>Status</label>
              <select class="form-control" id="fStatus">
                ${['New','Contacted','Booked','Converted','Lost'].map(s=>`<option${l.status===s?' selected':''}>${s}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-group"><label>Service Interest</label>
            <select class="form-control" id="fService"><option value="">— Select service —</option>${svcOpts}</select></div>
          <div class="form-group"><label>Follow-up Date</label>
            <input class="form-control" id="fFollowup" type="date" value="${l.follow_up_date||''}"></div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes" rows="3">${l.notes||''}</textarea></div>`;
      },

      openAddLead() {
        MPC.ui.showModal('Add Lead', MPC.modules.crm._leadForm(), async () => {
          const name = document.getElementById('fName').value.trim();
          if (!name) throw new Error('Name is required');
          await MPC.db.add('leads', {
            name, phone: document.getElementById('fPhone').value.trim(),
            email: document.getElementById('fEmail').value.trim(),
            source: document.getElementById('fSource').value,
            status: document.getElementById('fStatus').value,
            service_interest: document.getElementById('fService').value,
            follow_up_date: document.getElementById('fFollowup').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Lead added');
          await MPC.navigate('crm', 'leads');
        });
      },

      async editLead(id) {
        const l = MPC.modules.crm._leadsData.find(x => x.id === id);
        if (!l) return;
        MPC.ui.showModal('Edit Lead', MPC.modules.crm._leadForm(l), async () => {
          const name = document.getElementById('fName').value.trim();
          if (!name) throw new Error('Name is required');
          await MPC.db.update('leads', id, {
            name, phone: document.getElementById('fPhone').value.trim(),
            email: document.getElementById('fEmail').value.trim(),
            source: document.getElementById('fSource').value,
            status: document.getElementById('fStatus').value,
            service_interest: document.getElementById('fService').value,
            follow_up_date: document.getElementById('fFollowup').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Lead updated');
          await MPC.navigate('crm', 'leads');
        });
      },

      async deleteLead(id) {
        const ok = await MPC.ui.confirm('Delete this lead? This cannot be undone.');
        if (!ok) return;
        await MPC.db.delete('leads', id);
        MPC.ui.showToast('Lead deleted', 'warning');
        await MPC.navigate('crm', 'leads');
      },

      async renderCorporate() {
        const rows = await MPC.db.getAll('corporate_pipeline', 'created_at', false);
        document.getElementById('crmTabContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <span class="card-title">Corporate Pipeline</span>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.crm.openAddCorporate()">+ Add Company</button>
            </div>
            ${!rows.length ? `<div class="table-empty"><span class="empty-icon">🏢</span>No corporate prospects yet.</div>` : `
            <table><thead><tr>
              <th>Company</th><th>Contact</th><th>Role</th><th>Stage</th>
              <th>Next Action</th><th>Date</th><th>Actions</th>
            </tr></thead><tbody>
              ${rows.map(c => `<tr>
                <td class="fw-600">${c.company}</td>
                <td>${c.contact_name}</td>
                <td class="text-muted">${c.role||'—'}</td>
                <td>${MPC.fmt.statusBadge(c.stage)}</td>
                <td>${c.next_action||'—'}</td>
                <td>${MPC.fmt.date(c.next_action_date)}</td>
                <td><div class="action-btns">
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.crm.editCorporate('${c.id}')">✏️</button>
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.crm.deleteCorporate('${c.id}')">🗑️</button>
                </div></td>
              </tr>`).join('')}
            </tbody></table>`}
          </div>`;
        MPC.modules.crm._corpData = rows;
      },

      _corpData: [],
      _corpForm(c = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Company *</label>
              <input class="form-control" id="fCompany" value="${c.company||''}" placeholder="Acme Ltd" required></div>
            <div class="form-group"><label>Contact Name *</label>
              <input class="form-control" id="fContactName" value="${c.contact_name||''}" placeholder="John Smith" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Role</label>
              <input class="form-control" id="fRole" value="${c.role||''}" placeholder="CEO"></div>
            <div class="form-group"><label>Stage</label>
              <select class="form-control" id="fStage">
                ${['Aware','Connected','Engaged','Meeting','Proposal','Client'].map(s=>`<option${c.stage===s?' selected':''}>${s}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Next Action</label>
              <input class="form-control" id="fNextAction" value="${c.next_action||''}" placeholder="Send intro email"></div>
            <div class="form-group"><label>Next Action Date</label>
              <input class="form-control" id="fNextDate" type="date" value="${c.next_action_date||''}"></div>
          </div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${c.notes||''}</textarea></div>`;
      },

      openAddCorporate() {
        MPC.ui.showModal('Add Company', MPC.modules.crm._corpForm(), async () => {
          const company = document.getElementById('fCompany').value.trim();
          const contact_name = document.getElementById('fContactName').value.trim();
          if (!company || !contact_name) throw new Error('Company and contact name required');
          await MPC.db.add('corporate_pipeline', {
            company, contact_name, role: document.getElementById('fRole').value.trim(),
            stage: document.getElementById('fStage').value,
            next_action: document.getElementById('fNextAction').value.trim(),
            next_action_date: document.getElementById('fNextDate').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Company added');
          await MPC.navigate('crm', 'corporate');
        });
      },

      async editCorporate(id) {
        const c = MPC.modules.crm._corpData.find(x => x.id === id);
        if (!c) return;
        MPC.ui.showModal('Edit Company', MPC.modules.crm._corpForm(c), async () => {
          await MPC.db.update('corporate_pipeline', id, {
            company: document.getElementById('fCompany').value.trim(),
            contact_name: document.getElementById('fContactName').value.trim(),
            role: document.getElementById('fRole').value.trim(),
            stage: document.getElementById('fStage').value,
            next_action: document.getElementById('fNextAction').value.trim(),
            next_action_date: document.getElementById('fNextDate').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Company updated');
          await MPC.navigate('crm', 'corporate');
        });
      },

      async deleteCorporate(id) {
        const ok = await MPC.ui.confirm('Delete this company from the pipeline?');
        if (!ok) return;
        await MPC.db.delete('corporate_pipeline', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.navigate('crm', 'corporate');
      },

      async renderReferrers() {
        const rows = await MPC.db.getAll('referrers');
        document.getElementById('crmTabContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <span class="card-title">Referrers</span>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.crm.openAddReferrer()">+ Add Referrer</button>
            </div>
            ${!rows.length ? `<div class="table-empty"><span class="empty-icon">🤝</span>No referrers yet.</div>` : `
            <table><thead><tr>
              <th>Name</th><th>Type</th><th>Organisation</th>
              <th>Total Referrals</th><th>Last Referral</th><th>Actions</th>
            </tr></thead><tbody>
              ${rows.map(r => `<tr>
                <td class="fw-600">${r.name}</td>
                <td>${MPC.fmt.statusBadge(r.type)}</td>
                <td>${r.organisation||'—'}</td>
                <td>${r.total_referrals}</td>
                <td>${MPC.fmt.date(r.last_referral)}</td>
                <td><div class="action-btns">
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.crm.editReferrer('${r.id}')">✏️</button>
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.crm.deleteReferrer('${r.id}')">🗑️</button>
                </div></td>
              </tr>`).join('')}
            </tbody></table>`}
          </div>`;
        MPC.modules.crm._refData = rows;
      },

      _refData: [],
      _refForm(r = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Name *</label>
              <input class="form-control" id="fName" value="${r.name||''}" required></div>
            <div class="form-group"><label>Type</label>
              <select class="form-control" id="fType">
                ${['GP','Consultant','Coach','Business Owner','Other'].map(t=>`<option${r.type===t?' selected':''}>${t}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Organisation</label>
              <input class="form-control" id="fOrg" value="${r.organisation||''}"></div>
            <div class="form-group"><label>Total Referrals</label>
              <input class="form-control" id="fTotal" type="number" min="0" value="${r.total_referrals||0}"></div>
          </div>
          <div class="form-group"><label>Last Referral Date</label>
            <input class="form-control" id="fLastRef" type="date" value="${r.last_referral||''}"></div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${r.notes||''}</textarea></div>`;
      },

      openAddReferrer() {
        MPC.ui.showModal('Add Referrer', MPC.modules.crm._refForm(), async () => {
          const name = document.getElementById('fName').value.trim();
          if (!name) throw new Error('Name required');
          await MPC.db.add('referrers', {
            name, type: document.getElementById('fType').value,
            organisation: document.getElementById('fOrg').value.trim(),
            total_referrals: parseInt(document.getElementById('fTotal').value)||0,
            last_referral: document.getElementById('fLastRef').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Referrer added');
          await MPC.navigate('crm', 'referrers');
        });
      },

      async editReferrer(id) {
        const r = MPC.modules.crm._refData.find(x => x.id === id);
        if (!r) return;
        MPC.ui.showModal('Edit Referrer', MPC.modules.crm._refForm(r), async () => {
          await MPC.db.update('referrers', id, {
            name: document.getElementById('fName').value.trim(),
            type: document.getElementById('fType').value,
            organisation: document.getElementById('fOrg').value.trim(),
            total_referrals: parseInt(document.getElementById('fTotal').value)||0,
            last_referral: document.getElementById('fLastRef').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Referrer updated');
          await MPC.navigate('crm', 'referrers');
        });
      },

      async deleteReferrer(id) {
        const ok = await MPC.ui.confirm('Delete this referrer?');
        if (!ok) return;
        await MPC.db.delete('referrers', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.navigate('crm', 'referrers');
      }
    },

    // ── FINANCIALS ──────────────────────────────────────────────
    financials: {
      _txData: [],

      async render() {
        const rows = await MPC.db.getAll('transactions', 'date', false);
        MPC.modules.financials._txData = rows;

        const now = new Date();
        const todayStr   = now.toISOString().slice(0, 10);
        const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart  = new Date(now.getFullYear(), 0, 1);

        const sum = (arr) => arr.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const today   = rows.filter(t => t.date === todayStr);
        const week    = rows.filter(t => new Date(t.date) >= weekStart);
        const month   = rows.filter(t => new Date(t.date) >= monthStart);
        const year    = rows.filter(t => new Date(t.date) >= yearStart);

        const monthlyTarget = parseFloat(localStorage.getItem('mpc_monthly_target') || 0);

        // Build monthly chart data (last 6 months)
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const total = rows.filter(t => { const td = new Date(t.date); return td >= d && td < end; }).reduce((s, t) => s + parseFloat(t.amount||0), 0);
          monthlyData.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), value: total });
        }
        const maxVal = Math.max(...monthlyData.map(m => m.value), 1);

        document.getElementById('pageContent').innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><span class="stat-icon">💷</span>
              <div class="stat-label">Today</div>
              <div class="stat-value">${MPC.fmt.money(sum(today))}</div>
              <div class="stat-change">${today.length} transactions</div>
            </div>
            <div class="stat-card"><span class="stat-icon">📅</span>
              <div class="stat-label">This Week</div>
              <div class="stat-value">${MPC.fmt.money(sum(week))}</div>
              <div class="stat-change">${week.length} transactions</div>
            </div>
            <div class="stat-card"><span class="stat-icon">📆</span>
              <div class="stat-label">This Month</div>
              <div class="stat-value">${MPC.fmt.money(sum(month))}</div>
              <div class="stat-change">${monthlyTarget ? `Target: ${MPC.fmt.money(monthlyTarget)}` : 'Set a target below'}</div>
            </div>
            <div class="stat-card"><span class="stat-icon">📈</span>
              <div class="stat-label">This Year</div>
              <div class="stat-value">${MPC.fmt.money(sum(year))}</div>
              <div class="stat-change">${year.length} transactions</div>
            </div>
          </div>

          <div class="grid-2 mb-24">
            <div class="card">
              <div class="card-header">
                <span class="card-title">Monthly Revenue</span>
              </div>
              <div class="monthly-chart">
                ${monthlyData.map(m => {
                  const pct = maxVal > 0 ? Math.round((m.value / maxVal) * 100) : 0;
                  return `<div class="month-bar-wrap">
                    <span class="month-val">${m.value > 0 ? MPC.fmt.money(m.value).replace('£','£') : ''}</span>
                    <div class="month-bar" style="height:${pct}%"></div>
                    <span class="month-label">${m.label}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
            <div class="card">
              <div class="card-header"><span class="card-title">Monthly Target</span></div>
              <div class="form-group" style="margin-bottom:8px"><label>Target (£)</label>
                <input class="form-control" id="monthlyTarget" type="number" min="0"
                  value="${monthlyTarget||''}" placeholder="e.g. 2400">
              </div>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.financials.saveTarget()">Save Target</button>
              ${monthlyTarget > 0 ? (() => {
                const pct = Math.min(Math.round((sum(month) / monthlyTarget) * 100), 100);
                const cls = pct >= 100 ? 'success' : pct >= 70 ? '' : 'danger';
                return `<div class="mt-16">
                  <div class="goal-values mb-16"><span class="goal-current">${MPC.fmt.money(sum(month))}</span><span class="goal-target">of ${MPC.fmt.money(monthlyTarget)}</span></div>
                  <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
                  <p class="text-sm text-muted mt-8">${pct}% of monthly target</p>
                </div>`;
              })() : ''}
            </div>
          </div>

          <div class="table-container">
            <div class="table-header">
              <span class="card-title">Transaction Log</span>
              <div class="table-filters">
                <input class="search-input" id="txSearch" placeholder="Search…" oninput="MPC.modules.financials.filterTx(this.value)">
                <button class="btn btn-primary btn-sm" onclick="MPC.modules.financials.openAddTransaction()">+ Add Transaction</button>
              </div>
            </div>
            <div id="txTableWrap">${MPC.modules.financials._txTable(rows)}</div>
          </div>`;
      },

      _txTable(rows) {
        if (!rows.length) return `<div class="table-empty"><span class="empty-icon">💰</span>No transactions yet.</div>`;
        return `<table><thead><tr>
          <th>Date</th><th>Service</th><th>Amount</th><th>Payment</th><th>Notes</th><th>Actions</th>
        </tr></thead><tbody>
          ${rows.map(t => `<tr>
            <td>${MPC.fmt.date(t.date)}</td>
            <td>${t.service}</td>
            <td class="text-gold fw-600">${MPC.fmt.money(t.amount)}</td>
            <td>${t.payment_method}</td>
            <td class="text-muted truncate">${t.notes||'—'}</td>
            <td><div class="action-btns">
              <button class="btn btn-ghost btn-icon" onclick="MPC.modules.financials.editTx('${t.id}')">✏️</button>
              <button class="btn btn-ghost btn-icon" onclick="MPC.modules.financials.deleteTx('${t.id}')">🗑️</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table>`;
      },

      filterTx(s) {
        s = (s||'').toLowerCase();
        const filtered = MPC.modules.financials._txData.filter(t =>
          t.service.toLowerCase().includes(s) || (t.notes||'').toLowerCase().includes(s)
        );
        document.getElementById('txTableWrap').innerHTML = MPC.modules.financials._txTable(filtered);
      },

      saveTarget() {
        const val = document.getElementById('monthlyTarget').value;
        localStorage.setItem('mpc_monthly_target', val || 0);
        MPC.ui.showToast('Target saved');
        MPC.modules.financials.render();
      },

      _txForm(t = {}) {
        const svcOpts = MPC.services.map(s => `<option${t.service===s?' selected':''}>${s}</option>`).join('');
        return `
          <div class="form-row">
            <div class="form-group"><label>Date *</label>
              <input class="form-control" id="fDate" type="date" value="${t.date||new Date().toISOString().slice(0,10)}" required></div>
            <div class="form-group"><label>Amount (£) *</label>
              <input class="form-control" id="fAmount" type="number" min="0" step="0.01" value="${t.amount||''}" required></div>
          </div>
          <div class="form-group"><label>Service *</label>
            <select class="form-control" id="fService"><option value="">— Select —</option>${svcOpts}</select></div>
          <div class="form-group"><label>Payment Method</label>
            <select class="form-control" id="fPayment">
              ${['Card','Cash','Bank Transfer'].map(p=>`<option${t.payment_method===p?' selected':''}>${p}</option>`).join('')}
            </select></div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${t.notes||''}</textarea></div>`;
      },

      openAddTransaction() {
        MPC.ui.showModal('Add Transaction', MPC.modules.financials._txForm(), async () => {
          const date = document.getElementById('fDate').value;
          const amount = parseFloat(document.getElementById('fAmount').value);
          const service = document.getElementById('fService').value;
          if (!date || !amount || !service) throw new Error('Date, amount and service required');
          await MPC.db.add('transactions', {
            date, amount, service,
            payment_method: document.getElementById('fPayment').value,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Transaction added');
          await MPC.modules.financials.render();
        });
      },

      async editTx(id) {
        const t = MPC.modules.financials._txData.find(x => x.id === id);
        if (!t) return;
        MPC.ui.showModal('Edit Transaction', MPC.modules.financials._txForm(t), async () => {
          await MPC.db.update('transactions', id, {
            date: document.getElementById('fDate').value,
            amount: parseFloat(document.getElementById('fAmount').value),
            service: document.getElementById('fService').value,
            payment_method: document.getElementById('fPayment').value,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Transaction updated');
          await MPC.modules.financials.render();
        });
      },

      async deleteTx(id) {
        const ok = await MPC.ui.confirm('Delete this transaction?');
        if (!ok) return;
        await MPC.db.delete('transactions', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.financials.render();
      }
    },

    // ── COMPLIANCE ──────────────────────────────────────────────
    compliance: {
      _data: [],

      async render() {
        const rows = await MPC.db.getAll('compliance_items', 'created_at', false);
        MPC.modules.compliance._data = rows;

        // Auto-compute status based on expiry date
        const enriched = rows.map(c => {
          let status = c.status;
          const date = c.expiry_date || c.review_date;
          if (date) {
            const days = MPC.fmt.daysUntil(date);
            if (days < 0) status = 'Expired';
            else if (days <= 30) status = 'Due Soon';
          }
          return { ...c, computedStatus: status };
        });

        document.getElementById('pageContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <div class="table-filters">
                <select class="filter-select" id="compCatFilter" onchange="MPC.modules.compliance.filter()">
                  <option value="">All Categories</option>
                  ${['CQC','GMC','Insurance','CPD','DBS','Policy','Incident','Complaint'].map(c=>`<option>${c}</option>`).join('')}
                </select>
                <select class="filter-select" id="compStatusFilter" onchange="MPC.modules.compliance.filter()">
                  <option value="">All Statuses</option>
                  <option>Active</option><option>Due Soon</option><option>Expired</option><option>Completed</option>
                </select>
              </div>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.compliance.openAdd()">+ Add Item</button>
            </div>
            <div id="compTableWrap">${MPC.modules.compliance._table(enriched)}</div>
          </div>`;
        MPC.modules.compliance._enriched = enriched;
      },

      _enriched: [],
      _table(rows) {
        if (!rows.length) return `<div class="table-empty"><span class="empty-icon">✅</span>No compliance items yet.</div>`;
        return `<table><thead><tr>
          <th>Category</th><th>Title</th><th>Status</th><th>Expiry / Review Date</th><th>Notes</th><th>Actions</th>
        </tr></thead><tbody>
          ${rows.map(c => `<tr>
            <td>${MPC.fmt.statusBadge(c.category)}</td>
            <td class="fw-600">${c.title}</td>
            <td>${MPC.fmt.statusBadge(c.computedStatus || c.status)}</td>
            <td>${MPC.fmt.date(c.expiry_date || c.review_date)}</td>
            <td class="text-muted truncate">${c.notes||'—'}</td>
            <td><div class="action-btns">
              <button class="btn btn-ghost btn-icon" onclick="MPC.modules.compliance.edit('${c.id}')">✏️</button>
              <button class="btn btn-ghost btn-icon" onclick="MPC.modules.compliance.del('${c.id}')">🗑️</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table>`;
      },

      filter() {
        const cat    = document.getElementById('compCatFilter')?.value || '';
        const status = document.getElementById('compStatusFilter')?.value || '';
        const filtered = MPC.modules.compliance._enriched.filter(c =>
          (!cat    || c.category === cat) &&
          (!status || (c.computedStatus || c.status) === status)
        );
        document.getElementById('compTableWrap').innerHTML = MPC.modules.compliance._table(filtered);
      },

      _form(c = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Category *</label>
              <select class="form-control" id="fCat">
                ${['CQC','GMC','Insurance','CPD','DBS','Policy','Incident','Complaint'].map(x=>`<option${c.category===x?' selected':''}>${x}</option>`).join('')}
              </select></div>
            <div class="form-group"><label>Status</label>
              <select class="form-control" id="fStatus">
                ${['Active','Completed'].map(s=>`<option${c.status===s?' selected':''}>${s}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-group"><label>Title *</label>
            <input class="form-control" id="fTitle" value="${c.title||''}" required placeholder="e.g. CQC Registration"></div>
          <div class="form-row">
            <div class="form-group"><label>Expiry Date</label>
              <input class="form-control" id="fExpiry" type="date" value="${c.expiry_date||''}"></div>
            <div class="form-group"><label>Review Date</label>
              <input class="form-control" id="fReview" type="date" value="${c.review_date||''}"></div>
          </div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${c.notes||''}</textarea></div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Compliance Item', MPC.modules.compliance._form(), async () => {
          const title = document.getElementById('fTitle').value.trim();
          if (!title) throw new Error('Title required');
          await MPC.db.add('compliance_items', {
            category: document.getElementById('fCat').value,
            title, status: document.getElementById('fStatus').value,
            expiry_date: document.getElementById('fExpiry').value || null,
            review_date: document.getElementById('fReview').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Item added');
          await MPC.modules.compliance.render();
        });
      },

      async edit(id) {
        const c = MPC.modules.compliance._data.find(x => x.id === id);
        if (!c) return;
        MPC.ui.showModal('Edit Item', MPC.modules.compliance._form(c), async () => {
          await MPC.db.update('compliance_items', id, {
            category: document.getElementById('fCat').value,
            title: document.getElementById('fTitle').value.trim(),
            status: document.getElementById('fStatus').value,
            expiry_date: document.getElementById('fExpiry').value || null,
            review_date: document.getElementById('fReview').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Item updated');
          await MPC.modules.compliance.render();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Delete this compliance item?');
        if (!ok) return;
        await MPC.db.delete('compliance_items', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.compliance.render();
      }
    },

    // ── ANALYTICS ───────────────────────────────────────────────
    analytics: {
      async render() {
        const [leads, transactions] = await Promise.all([
          MPC.db.getAll('leads'),
          MPC.db.getAll('transactions')
        ]);

        // Lead sources
        const sourceMap = {};
        leads.forEach(l => { sourceMap[l.source] = (sourceMap[l.source]||0) + 1; });
        const sources = Object.entries(sourceMap).sort((a,b) => b[1]-a[1]);
        const maxSrc  = Math.max(...sources.map(s=>s[1]), 1);

        // Revenue by service
        const svcMap = {};
        transactions.forEach(t => { svcMap[t.service] = (svcMap[t.service]||0) + parseFloat(t.amount||0); });
        const services = Object.entries(svcMap).sort((a,b) => b[1]-a[1]).slice(0, 8);
        const maxSvc   = Math.max(...services.map(s=>s[1]), 1);

        // Monthly leads trend (last 6 months)
        const now = new Date();
        const trendData = [];
        for (let i = 5; i >= 0; i--) {
          const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const cnt = leads.filter(l => { const ld = new Date(l.created_at); return ld >= d && ld < end; }).length;
          trendData.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), value: cnt });
        }
        const maxTrend = Math.max(...trendData.map(t=>t.value), 1);

        // Conversion funnel
        const funnelSteps = [
          { label: 'All Leads',  count: leads.length,                              color: '#58a6ff' },
          { label: 'Contacted',  count: leads.filter(l=>['Contacted','Booked','Converted'].includes(l.status)).length, color: '#bc8cff' },
          { label: 'Booked',     count: leads.filter(l=>['Booked','Converted'].includes(l.status)).length, color: '#f0b429' },
          { label: 'Converted',  count: leads.filter(l=>l.status==='Converted').length, color: '#3fb950' }
        ];
        const maxFunnel = Math.max(leads.length, 1);

        document.getElementById('pageContent').innerHTML = `
          <div class="grid-2 mb-24">
            <div class="card">
              <div class="card-header"><span class="card-title">Lead Sources</span></div>
              ${sources.length === 0 ? '<p class="text-muted text-sm">No data yet.</p>' :
              `<div class="chart-container">
                ${sources.map(([src, cnt]) => `
                  <div class="chart-bar-group">
                    <span class="chart-label">${src}</span>
                    <div class="chart-track"><div class="chart-fill" style="width:${Math.round((cnt/maxSrc)*100)}%"></div></div>
                    <span class="chart-value">${cnt} (${Math.round((cnt/leads.length)*100)}%)</span>
                  </div>`).join('')}
              </div>`}
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Revenue by Service</span></div>
              ${services.length === 0 ? '<p class="text-muted text-sm">No data yet.</p>' :
              `<div class="chart-container">
                ${services.map(([svc, total]) => `
                  <div class="chart-bar-group">
                    <span class="chart-label">${svc.replace(' — £' + svc.split('£')[1], '')}</span>
                    <div class="chart-track"><div class="chart-fill blue" style="width:${Math.round((total/maxSvc)*100)}%"></div></div>
                    <span class="chart-value">${MPC.fmt.money(total)}</span>
                  </div>`).join('')}
              </div>`}
            </div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header"><span class="card-title">Monthly Leads Trend</span></div>
              <div class="trend-chart">
                ${trendData.map(m => `
                  <div class="trend-bar-wrap">
                    <span class="trend-bar-val">${m.value||''}</span>
                    <div class="trend-bar" style="height:${maxTrend>0?Math.max(Math.round((m.value/maxTrend)*80),2):2}px"></div>
                    <span class="trend-bar-label">${m.label}</span>
                  </div>`).join('')}
              </div>
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Conversion Funnel</span></div>
              <div class="funnel">
                ${funnelSteps.map(s => {
                  const w = maxFunnel > 0 ? Math.max(Math.round((s.count/maxFunnel)*100), 5) : 5;
                  return `<div class="funnel-step">
                    <span class="funnel-label">${s.label}</span>
                    <div class="funnel-bar-wrap">
                      <div class="funnel-bar" style="width:${w}%;background:${s.color}">${s.count}</div>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>`;
      }
    },

    // ── MARKETING CALENDAR ──────────────────────────────────────
    marketing: {
      _data: [],
      _tab: 'calendar',

      async render() {
        const tab = MPC.modules.marketing._tab;
        document.getElementById('pageContent').innerHTML = `
          <div class="subtabs">
            <button class="subtab${tab==='calendar'?' active':''}" onclick="MPC.modules.marketing.switchTab('calendar')">Content Calendar</button>
            <button class="subtab${tab==='linkedin'?' active':''}" onclick="MPC.modules.marketing.switchTab('linkedin')">LinkedIn Posts</button>
            <button class="subtab${tab==='engagement'?' active':''}" onclick="MPC.modules.marketing.switchTab('engagement')">Engagement</button>
          </div>
          <div id="mktTabContent"></div>`;
        if (tab === 'calendar') await MPC.modules.marketing.renderCalendar();
        else if (tab === 'linkedin') await MPC.modules.marketing.renderLinkedIn();
        else await MPC.modules.marketing.renderEngagement();
      },

      async switchTab(tab) {
        MPC.modules.marketing._tab = tab;
        await MPC.modules.marketing.render();
        MPC.ui.makeTablesResponsive();
      },

      // ── Calendar subtab ────────────────────────────────────────
      async renderCalendar() {
        const rows = await MPC.db.getAll('content_calendar', 'scheduled_date', false);
        MPC.modules.marketing._data = rows;

        const statuses = ['Idea','Drafting','Scheduled','Published'];
        const colors   = { Idea:'var(--text-muted)', Drafting:'var(--warning)', Scheduled:'var(--primary)', Published:'var(--success)' };

        const col = (status) => {
          const cards = rows.filter(r => r.status === status);
          const colId = 'kanban-col-' + status.toLowerCase();
          return `
            <div class="kanban-col">
              <div class="kanban-col-header" style="border-top:3px solid ${colors[status]}" onclick="MPC.modules.marketing.toggleCol('${colId}')" role="button">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="kanban-col-title">${status}</span>
                  <span class="kanban-col-count">${cards.length}</span>
                </div>
                <span class="kanban-col-chevron" id="${colId}-chevron">▾</span>
              </div>
              <div class="kanban-cards" id="${colId}">
                ${cards.length ? cards.map(c => `
                  <div class="kanban-card">
                    <div class="kanban-card-title">${c.title}</div>
                    ${c.scheduled_date ? `<div class="kanban-card-date">📅 ${MPC.fmt.date(c.scheduled_date)}</div>` : ''}
                    ${c.notes ? `<div class="kanban-card-note">${c.notes}</div>` : ''}
                    <div class="kanban-card-footer">
                      <span class="kanban-card-platform">${c.platform||'LinkedIn'}</span>
                      <div class="action-btns">
                        <button class="btn btn-ghost btn-icon" title="Edit" onclick="MPC.modules.marketing.edit('${c.id}')">✏️</button>
                        <button class="btn btn-ghost btn-icon" title="Delete" onclick="MPC.modules.marketing.del('${c.id}')">🗑️</button>
                      </div>
                    </div>
                  </div>`).join('') : `<div class="kanban-empty">No posts</div>`}
              </div>
            </div>`;
        };

        document.getElementById('mktTabContent').innerHTML = `
          <div class="kanban-toolbar">
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.marketing.openAdd()">+ Add Post</button>
              <button class="btn btn-secondary btn-sm" id="sheetsSyncBtn" onclick="MPC.modules.marketing.syncFromSheets()">↻ Sync from Google Sheets</button>
              <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0">
                Import CSV
                <input type="file" accept=".csv" style="display:none" onchange="MPC.modules.marketing.importCSV(event)">
              </label>
            </div>
          </div>
          <div class="kanban-board">
            ${statuses.map(s => col(s)).join('')}
          </div>`;

        // On mobile, collapse all columns by default
        if (window.innerWidth <= 768) {
          statuses.forEach(s => {
            const id = 'kanban-col-' + s.toLowerCase();
            const el = document.getElementById(id);
            const ch = document.getElementById(id + '-chevron');
            if (el) el.style.display = 'none';
            if (ch) ch.textContent = '▸';
          });
        }
      },

      toggleCol(colId) {
        const cards = document.getElementById(colId);
        const chevron = document.getElementById(colId + '-chevron');
        if (!cards) return;
        const collapsed = cards.style.display === 'none';
        cards.style.display = collapsed ? '' : 'none';
        if (chevron) chevron.textContent = collapsed ? '▾' : '▸';
      },

      async importCSV(event) {
        const file = event.target.files[0];
        if (!file) return;
        const text = await file.text();
        const lines = text.split('\n').slice(1).filter(l => l.trim());

        const parseDate = (raw) => {
          if (!raw) return null;
          const m = raw.match(/(\d+)(?:st|nd|rd|th)\s+(\w+)/i);
          if (!m) return null;
          const months = {january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
          const mon = months[m[2].toLowerCase()];
          if (!mon) return null;
          const year = parseInt(mon) >= new Date().getMonth() - 2 ? new Date().getFullYear() : new Date().getFullYear();
          return `${year}-${mon}-${m[1].padStart(2,'0')}`;
        };

        const mapStatus = (s) => {
          if (!s) return 'Idea';
          s = s.toUpperCase().trim();
          if (s.includes('POSTED')) return 'Published';
          if (s.includes('READY')) return 'Scheduled';
          if (s.includes('TRANSCRIBED') || s.includes('DRAFTED')) return 'Drafting';
          return 'Idea';
        };

        // Parse CSV (handles quoted fields with newlines)
        const parseCSV = (csv) => {
          const rows = []; let cur = []; let field = ''; let inQ = false;
          for (let i = 0; i < csv.length; i++) {
            const ch = csv[i];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cur.push(field); field = ''; }
            else if ((ch === '\n') && !inQ) { cur.push(field); rows.push(cur); cur = []; field = ''; }
            else { field += ch; }
          }
          if (field || cur.length) { cur.push(field); rows.push(cur); }
          return rows;
        };

        const parsed = parseCSV(text).slice(1).filter(r => r.length >= 3 && r[2]?.trim());
        const toInsert = parsed.map(r => ({
          scheduled_date: parseDate(r[0]),
          notes:          r[1]?.trim() || null,
          title:          r[2]?.trim().split('\n')[0].slice(0,200) || 'Untitled',
          status:         mapStatus(r[5]),
          platform:       'LinkedIn',
          reactions:      0,
          comments:       0
        })).filter(r => r.title && r.title !== 'Untitled' || r.scheduled_date);

        if (!toInsert.length) { MPC.ui.showToast('No valid rows found in CSV', 'warning'); return; }

        const { error } = await MPC.supabase.from('content_calendar').insert(toInsert);
        if (error) { MPC.ui.showToast('Import failed: ' + error.message, 'danger'); return; }
        MPC.ui.showToast(`Imported ${toInsert.length} posts`);
        await MPC.modules.marketing.renderCalendar();
      },

      async syncFromSheets() {
        const btn = document.getElementById('sheetsSyncBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
        try {
          const url = typeof CONTENT_CALENDAR_CSV_URL !== 'undefined' ? CONTENT_CALENDAR_CSV_URL : '';
          if (!url) throw new Error('CONTENT_CALENDAR_CSV_URL not set in config.js');

          const res = await fetch(url);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const text = await res.text();

          // Reuse the same CSV parser + mapper from importCSV
          const fakeEvent = { target: { files: [new File([text], 'sheet.csv', { type: 'text/csv' })] } };
          await MPC.modules.marketing.importCSV(fakeEvent);
        } catch (err) {
          MPC.ui.showToast('Sync failed: ' + err.message, 'danger');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = '↻ Sync from Google Sheets'; }
        }
      },

      _form(c = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Platform *</label>
              <select class="form-control" id="fPlatform">
                ${['LinkedIn','Instagram','Facebook','Leaflet','Email','Other'].map(p=>`<option${c.platform===p?' selected':''}>${p}</option>`).join('')}
              </select></div>
            <div class="form-group"><label>Status</label>
              <select class="form-control" id="fStatus">
                ${['Idea','Drafting','Scheduled','Published'].map(s=>`<option${c.status===s?' selected':''}>${s}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-group"><label>Title *</label>
            <input class="form-control" id="fTitle" value="${c.title||''}" required placeholder="Post title or topic"></div>
          <div class="form-row">
            <div class="form-group"><label>Scheduled Date</label>
              <input class="form-control" id="fSched" type="date" value="${c.scheduled_date||''}"></div>
            <div class="form-group"><label>Published Date</label>
              <input class="form-control" id="fPublished" type="date" value="${c.published_date||''}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Reactions</label>
              <input class="form-control" id="fReactions" type="number" min="0" value="${c.reactions||0}"></div>
            <div class="form-group"><label>Comments</label>
              <input class="form-control" id="fComments" type="number" min="0" value="${c.comments||0}"></div>
          </div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${c.notes||''}</textarea></div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Content', MPC.modules.marketing._form(), async () => {
          const title = document.getElementById('fTitle').value.trim();
          if (!title) throw new Error('Title required');
          await MPC.db.add('content_calendar', {
            platform: document.getElementById('fPlatform').value,
            title, status: document.getElementById('fStatus').value,
            scheduled_date:  document.getElementById('fSched').value || null,
            published_date:  document.getElementById('fPublished').value || null,
            reactions:  parseInt(document.getElementById('fReactions').value)||0,
            comments:   parseInt(document.getElementById('fComments').value)||0,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Content added');
          await MPC.modules.marketing.renderCalendar();
        });
      },

      async edit(id) {
        const c = MPC.modules.marketing._data.find(x => x.id === id);
        if (!c) return;
        MPC.ui.showModal('Edit Content', MPC.modules.marketing._form(c), async () => {
          await MPC.db.update('content_calendar', id, {
            platform: document.getElementById('fPlatform').value,
            title: document.getElementById('fTitle').value.trim(),
            status: document.getElementById('fStatus').value,
            scheduled_date:  document.getElementById('fSched').value || null,
            published_date:  document.getElementById('fPublished').value || null,
            reactions:  parseInt(document.getElementById('fReactions').value)||0,
            comments:   parseInt(document.getElementById('fComments').value)||0,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Content updated');
          await MPC.modules.marketing.renderCalendar();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Delete this content item?');
        if (!ok) return;
        await MPC.db.delete('content_calendar', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.marketing.renderCalendar();
      },

      // ── LinkedIn subtab ────────────────────────────────────────
      async renderLinkedIn() {
        const { data: posts } = await MPC.supabase
          .from('linkedin_posts')
          .select('*')
          .order('published_at', { ascending: false });

        const totalReactions = (posts||[]).reduce((s,p) => s + (p.reactions||0), 0);
        const totalComments  = (posts||[]).reduce((s,p) => s + (p.comments||0), 0);
        const totalShares    = (posts||[]).reduce((s,p) => s + (p.shares||0), 0);
        const avgEngagement  = (posts||[]).length
          ? Math.round((totalReactions + totalComments + totalShares) / posts.length)
          : 0;

        document.getElementById('mktTabContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <span class="card-title">LinkedIn Posts — Dr Faizal Secretary</span>
              <button class="btn btn-primary btn-sm" id="liSyncBtn" onclick="MPC.modules.marketing.syncLinkedIn()">Sync from LinkedIn</button>
            </div>

            <div class="stats-grid" style="margin:0 0 20px">
              <div class="stat-card" style="--accent:var(--primary)">
                <div class="stat-label">Total Posts</div>
                <div class="stat-value">${(posts||[]).length}</div>
              </div>
              <div class="stat-card" style="--accent:var(--success)">
                <div class="stat-label">Total Reactions</div>
                <div class="stat-value">${totalReactions}</div>
              </div>
              <div class="stat-card" style="--accent:var(--warning)">
                <div class="stat-label">Total Comments</div>
                <div class="stat-value">${totalComments}</div>
              </div>
              <div class="stat-card" style="--accent:var(--teal)">
                <div class="stat-label">Avg Engagement</div>
                <div class="stat-value">${avgEngagement}</div>
              </div>
            </div>

            ${!(posts||[]).length
              ? `<div class="table-empty"><span class="empty-icon">💼</span>No posts synced yet. Click "Sync from LinkedIn" to pull your latest posts.</div>`
              : `<table><thead><tr>
                  <th>Date</th><th>Post</th><th>Type</th>
                  <th>👍 Reactions</th><th>💬 Comments</th><th>🔁 Shares</th><th>Link</th><th></th>
                </tr></thead><tbody>
                ${(posts||[]).map(p => `<tr>
                  <td style="white-space:nowrap">${MPC.fmt.date(p.published_at ? p.published_at.slice(0,10) : null)}</td>
                  <td class="truncate" style="max-width:320px" title="${(p.content||'').replace(/"/g,'&quot;')}">${p.content ? p.content.slice(0,100) + (p.content.length>100?'…':'') : '—'}</td>
                  <td>${p.post_type||'Post'}</td>
                  <td>${p.reactions||0}</td>
                  <td>${p.comments||0}</td>
                  <td>${p.shares||0}</td>
                  <td>${p.url ? `<a href="${p.url}" target="_blank" class="link-btn">View</a>` : '—'}</td>
                  <td><button class="btn btn-ghost btn-icon" onclick="MPC.modules.marketing.deletePost('${p.id}')">🗑️</button></td>
                </tr>`).join('')}
              </tbody></table>`
            }
            <div id="liStatus" style="margin-top:12px;font-size:13px;color:var(--text-muted)"></div>
          </div>`;
      },

      async syncLinkedIn() {
        const btn = document.getElementById('liSyncBtn');
        const status = document.getElementById('liStatus');
        if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
        if (status) status.textContent = 'Starting Apify actor…';

        try {
          const token = typeof APIFY_API_TOKEN !== 'undefined' ? APIFY_API_TOKEN : '';
          const profileUrl = typeof LINKEDIN_PROFILE_URL !== 'undefined' ? LINKEDIN_PROFILE_URL : '';
          if (!token) throw new Error('APIFY_API_TOKEN not set in config.js');

          // Run the actor synchronously (waits for completion, returns results)
          const runRes = await fetch(
            `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items?token=${token}&timeout=120`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetUrls: [profileUrl],
                maxPosts: 50
              })
            }
          );

          if (!runRes.ok) {
            const errText = await runRes.text();
            throw new Error(`Apify error ${runRes.status}: ${errText.slice(0,200)}`);
          }

          const items = await runRes.json();
          if (!Array.isArray(items) || !items.length) {
            if (status) status.textContent = 'No posts returned from Apify.';
            if (btn) { btn.disabled = false; btn.textContent = 'Sync from LinkedIn'; }
            return;
          }

          if (status) status.textContent = `Got ${items.length} posts. Saving to database…`;

          // Upsert into linkedin_posts
          const rows = items.map(item => ({
            post_id:      item.id || item.entityId || String(Math.random()),
            url:          item.linkedinUrl || item.url || null,
            content:      item.content || item.text || null,
            published_at: item.postedAt?.date || item.postedAt || null,
            reactions:    item.engagement?.likes || 0,
            comments:     item.engagement?.comments || 0,
            shares:       item.engagement?.shares || 0,
            post_type:    item.type || 'Post',
            image_url:    item.postImages?.[0]?.url || null,
            synced_at:    new Date().toISOString()
          }));

          const { error } = await MPC.supabase
            .from('linkedin_posts')
            .upsert(rows, { onConflict: 'post_id' });

          if (error) throw new Error(error.message);

          MPC.ui.showToast(`Synced ${rows.length} LinkedIn posts`);
          await MPC.modules.marketing.renderLinkedIn();
        } catch (err) {
          console.error('LinkedIn sync error:', err);
          MPC.ui.showToast('Sync failed: ' + err.message, 'danger');
          if (status) status.textContent = 'Error: ' + err.message;
          if (btn) { btn.disabled = false; btn.textContent = 'Sync from LinkedIn'; }
        }
      },

      // ── Engagement subtab ───────────────────────────────────────
      async renderEngagement() {
        document.getElementById('mktTabContent').innerHTML = `
          <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-secondary btn-sm" id="engSyncBtn" onclick="MPC.modules.marketing.loadEngagement()">↻ Refresh from Sheet</button>
          </div>
          <div id="engContent"><div class="loading-state"><div class="spinner"></div>Loading…</div></div>`;
        await MPC.modules.marketing.loadEngagement();
      },

      async loadEngagement() {
        const btn = document.getElementById('engSyncBtn');
        const wrap = document.getElementById('engContent');
        if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
        try {
          const url = typeof ENGAGEMENT_CSV_URL !== 'undefined' ? ENGAGEMENT_CSV_URL : '';
          const res = await fetch(url);
          if (!res.ok) throw new Error('Could not load sheet');
          const text = await res.text();

          // Parse CSV preserving quoted fields
          const parseCSV = (csv) => {
            const rows = []; let cur = []; let field = ''; let inQ = false;
            for (let i = 0; i < csv.length; i++) {
              const ch = csv[i];
              if (ch === '"') { inQ = !inQ; }
              else if (ch === ',' && !inQ) { cur.push(field.trim()); field = ''; }
              else if (ch === '\n' && !inQ) { cur.push(field.trim()); rows.push(cur); cur = []; field = ''; }
              else if (ch !== '\r') { field += ch; }
            }
            if (field || cur.length) { cur.push(field.trim()); rows.push(cur); }
            return rows;
          };

          const all = parseCSV(text);
          const headers = all[0];
          const rows = all.slice(1);

          // Build column arrays
          const cols = headers.map((h, i) => ({
            title: h,
            entries: rows.map(r => r[i] || '').filter(v => v && v !== ' ')
          })).filter(c => c.title);

          const colColors = ['var(--primary)','var(--success)','var(--purple)','var(--teal)','var(--warning)','var(--danger)'];

          const linkify = (val) => {
            const url = val.match(/https?:\/\/[^\s]+/) ? val.match(/https?:\/\/[^\s]+/)[0]
              : val.match(/linkedin\.com\/[^\s,]+/) ? 'https://' + val.match(/linkedin\.com\/[^\s,]+/)[0]
              : null;
            const note = url ? val.replace(url.replace('https://',''), '').replace('https://','').trim() : val;
            const cleanNote = note.replace(/^,?\s*/, '').trim();
            if (url) {
              const handle = url.match(/\/in\/([^/?]+)/)?.[1] || url.match(/\/company\/([^/?]+)/)?.[1] || '';
              return `<a href="${url}" target="_blank" class="eng-link">
                <span class="eng-link-name">${handle ? '@' + handle : cleanNote || 'View profile'}</span>
                ${cleanNote && handle ? `<span class="eng-link-note">${cleanNote}</span>` : ''}
              </a>`;
            }
            return `<span class="eng-plain">${val}</span>`;
          };

          wrap.innerHTML = `
            <div class="eng-grid">
              ${cols.map((col, i) => `
                <div class="eng-col">
                  <div class="eng-col-header" style="border-top:3px solid ${colColors[i % colColors.length]}">
                    <span class="eng-col-title">${col.title}</span>
                    <span class="kanban-col-count">${col.entries.length}</span>
                  </div>
                  <div class="eng-entries">
                    ${col.entries.map(e => `<div class="eng-entry">${linkify(e)}</div>`).join('')}
                  </div>
                </div>`).join('')}
            </div>`;
        } catch (err) {
          if (wrap) wrap.innerHTML = `<div class="table-empty"><span class="empty-icon">⚠️</span>${err.message}</div>`;
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh from Sheet'; }
        }
      },

      async deletePost(id) {
        const ok = await MPC.ui.confirm('Remove this post from the dashboard?');
        if (!ok) return;
        const { error } = await MPC.supabase.from('linkedin_posts').delete().eq('id', id);
        if (error) { MPC.ui.showToast('Delete failed: ' + error.message, 'danger'); return; }
        MPC.ui.showToast('Post removed', 'warning');
        await MPC.modules.marketing.renderLinkedIn();
      }
    },

    // ── REFERRALS (specialists) ─────────────────────────────────
    referrals: {
      _data: [],

      async render() {
        const rows = await MPC.db.getAll('referral_network');
        MPC.modules.referrals._data = rows;

        document.getElementById('pageContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <span class="card-title">Specialist Referral Network</span>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.referrals.openAdd()">+ Add Specialist</button>
            </div>
            ${!rows.length ? `<div class="table-empty"><span class="empty-icon">🏥</span>No specialists added yet.</div>` : `
            <table><thead><tr>
              <th>Name</th><th>Specialty</th><th>Hospital</th>
              <th>Referrals Sent</th><th>Avg Wait</th><th>Quality</th><th>Notes</th><th>Actions</th>
            </tr></thead><tbody>
              ${rows.map(r => `<tr>
                <td class="fw-600">${r.name}</td>
                <td>${r.specialty}</td>
                <td>${r.hospital||'—'}</td>
                <td>${r.referrals_sent}</td>
                <td>${r.avg_wait_days != null ? r.avg_wait_days + 'd' : '—'}</td>
                <td><span class="stars">${MPC.fmt.stars(r.quality_rating||0)}</span></td>
                <td class="text-muted truncate">${r.notes||'—'}</td>
                <td><div class="action-btns">
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.referrals.edit('${r.id}')">✏️</button>
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.referrals.del('${r.id}')">🗑️</button>
                </div></td>
              </tr>`).join('')}
            </tbody></table>`}
          </div>`;
      },

      _form(r = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Name *</label>
              <input class="form-control" id="fName" value="${r.name||''}" required></div>
            <div class="form-group"><label>Specialty *</label>
              <input class="form-control" id="fSpec" value="${r.specialty||''}" required placeholder="e.g. Cardiology"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Hospital / Clinic</label>
              <input class="form-control" id="fHosp" value="${r.hospital||''}"></div>
            <div class="form-group"><label>Referrals Sent</label>
              <input class="form-control" id="fSent" type="number" min="0" value="${r.referrals_sent||0}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Avg Wait (days)</label>
              <input class="form-control" id="fWait" type="number" min="0" value="${r.avg_wait_days||''}"></div>
            <div class="form-group"><label>Quality Rating (1–5)</label>
              <input class="form-control" id="fRating" type="number" min="1" max="5" value="${r.quality_rating||''}"></div>
          </div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${r.notes||''}</textarea></div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Specialist', MPC.modules.referrals._form(), async () => {
          const name = document.getElementById('fName').value.trim();
          const specialty = document.getElementById('fSpec').value.trim();
          if (!name || !specialty) throw new Error('Name and specialty required');
          await MPC.db.add('referral_network', {
            name, specialty,
            hospital: document.getElementById('fHosp').value.trim(),
            referrals_sent: parseInt(document.getElementById('fSent').value)||0,
            avg_wait_days: parseInt(document.getElementById('fWait').value)||null,
            quality_rating: parseInt(document.getElementById('fRating').value)||null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Specialist added');
          await MPC.modules.referrals.render();
        });
      },

      async edit(id) {
        const r = MPC.modules.referrals._data.find(x => x.id === id);
        if (!r) return;
        MPC.ui.showModal('Edit Specialist', MPC.modules.referrals._form(r), async () => {
          await MPC.db.update('referral_network', id, {
            name: document.getElementById('fName').value.trim(),
            specialty: document.getElementById('fSpec').value.trim(),
            hospital: document.getElementById('fHosp').value.trim(),
            referrals_sent: parseInt(document.getElementById('fSent').value)||0,
            avg_wait_days: parseInt(document.getElementById('fWait').value)||null,
            quality_rating: parseInt(document.getElementById('fRating').value)||null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Specialist updated');
          await MPC.modules.referrals.render();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Delete this specialist?');
        if (!ok) return;
        await MPC.db.delete('referral_network', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.referrals.render();
      }
    },

    // ── INVENTORY ────────────────────────────────────────────────
    inventory: {
      _data: [],

      async render() {
        const rows = await MPC.db.getAll('inventory', 'category', true);
        MPC.modules.inventory._data = rows;

        document.getElementById('pageContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <div class="table-filters">
                <select class="filter-select" id="invCatFilter" onchange="MPC.modules.inventory.filter()">
                  <option value="">All Categories</option>
                  ${['Clinical Supplies','Equipment','PPE','Medication','Office'].map(c=>`<option>${c}</option>`).join('')}
                </select>
              </div>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.inventory.openAdd()">+ Add Item</button>
            </div>
            <div id="invTableWrap">${MPC.modules.inventory._table(rows)}</div>
          </div>`;
      },

      _table(rows) {
        if (!rows.length) return `<div class="table-empty"><span class="empty-icon">📦</span>No inventory items yet.</div>`;
        return `<table><thead><tr>
          <th>Category</th><th>Item</th><th>Qty</th><th>Reorder Level</th>
          <th>Status</th><th>Last Ordered</th><th>Supplier</th><th>Actions</th>
        </tr></thead><tbody>
          ${rows.map(i => {
            const isLow = i.quantity <= i.reorder_level;
            return `<tr>
              <td>${i.category}</td>
              <td class="fw-600">${i.item_name}</td>
              <td class="${isLow ? 'text-danger fw-600' : ''}">${i.quantity}</td>
              <td>${i.reorder_level}</td>
              <td>${isLow ? MPC.fmt.statusBadge('Low Stock') : MPC.fmt.statusBadge('Active')}</td>
              <td>${MPC.fmt.date(i.last_ordered)}</td>
              <td>${i.supplier||'—'}</td>
              <td><div class="action-btns">
                <button class="btn btn-ghost btn-icon" onclick="MPC.modules.inventory.edit('${i.id}')">✏️</button>
                <button class="btn btn-ghost btn-icon" onclick="MPC.modules.inventory.del('${i.id}')">🗑️</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody></table>`;
      },

      filter() {
        const cat = document.getElementById('invCatFilter')?.value || '';
        const f = MPC.modules.inventory._data.filter(i => !cat || i.category === cat);
        document.getElementById('invTableWrap').innerHTML = MPC.modules.inventory._table(f);
      },

      _form(i = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Category *</label>
              <select class="form-control" id="fCat">
                ${['Clinical Supplies','Equipment','PPE','Medication','Office'].map(c=>`<option${i.category===c?' selected':''}>${c}</option>`).join('')}
              </select></div>
            <div class="form-group"><label>Item Name *</label>
              <input class="form-control" id="fItem" value="${i.item_name||''}" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Quantity</label>
              <input class="form-control" id="fQty" type="number" min="0" value="${i.quantity||0}"></div>
            <div class="form-group"><label>Reorder Level</label>
              <input class="form-control" id="fReorder" type="number" min="0" value="${i.reorder_level||5}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Last Ordered</label>
              <input class="form-control" id="fOrdered" type="date" value="${i.last_ordered||''}"></div>
            <div class="form-group"><label>Supplier</label>
              <input class="form-control" id="fSupplier" value="${i.supplier||''}"></div>
          </div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${i.notes||''}</textarea></div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Inventory Item', MPC.modules.inventory._form(), async () => {
          const item_name = document.getElementById('fItem').value.trim();
          if (!item_name) throw new Error('Item name required');
          await MPC.db.add('inventory', {
            category: document.getElementById('fCat').value,
            item_name, quantity: parseInt(document.getElementById('fQty').value)||0,
            reorder_level: parseInt(document.getElementById('fReorder').value)||5,
            last_ordered: document.getElementById('fOrdered').value || null,
            supplier: document.getElementById('fSupplier').value.trim(),
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Item added');
          await MPC.modules.inventory.render();
        });
      },

      async edit(id) {
        const i = MPC.modules.inventory._data.find(x => x.id === id);
        if (!i) return;
        MPC.ui.showModal('Edit Item', MPC.modules.inventory._form(i), async () => {
          await MPC.db.update('inventory', id, {
            category: document.getElementById('fCat').value,
            item_name: document.getElementById('fItem').value.trim(),
            quantity: parseInt(document.getElementById('fQty').value)||0,
            reorder_level: parseInt(document.getElementById('fReorder').value)||5,
            last_ordered: document.getElementById('fOrdered').value || null,
            supplier: document.getElementById('fSupplier').value.trim(),
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Item updated');
          await MPC.modules.inventory.render();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Delete this inventory item?');
        if (!ok) return;
        await MPC.db.delete('inventory', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.inventory.render();
      }
    },

    // ── TEAM ─────────────────────────────────────────────────────
    team: {
      _data: [],

      async render() {
        const rows = await MPC.db.getAll('team_members', 'start_date', false);
        MPC.modules.team._data = rows;

        document.getElementById('pageContent').innerHTML = `
          <div class="table-container">
            <div class="table-header">
              <span class="card-title">Team Members</span>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.team.openAdd()">+ Add Team Member</button>
            </div>
            ${!rows.length ? `<div class="table-empty"><span class="empty-icon">👤</span>No team members yet.</div>` : `
            <table><thead><tr>
              <th>Name</th><th>Role</th><th>Start Date</th><th>Contract</th>
              <th>DBS Expiry</th><th>Notes</th><th>Actions</th>
            </tr></thead><tbody>
              ${rows.map(m => {
                const dbsDays = m.dbs_expiry ? MPC.fmt.daysUntil(m.dbs_expiry) : null;
                const dbsWarn = dbsDays !== null && dbsDays <= 60;
                return `<tr>
                  <td class="fw-600">${m.name}</td>
                  <td>${m.role}</td>
                  <td>${MPC.fmt.date(m.start_date)}</td>
                  <td>${m.contract_type}</td>
                  <td class="${dbsWarn ? 'text-warning' : ''}">${MPC.fmt.date(m.dbs_expiry)}</td>
                  <td class="text-muted truncate">${m.notes||'—'}</td>
                  <td><div class="action-btns">
                    <button class="btn btn-ghost btn-icon" onclick="MPC.modules.team.edit('${m.id}')">✏️</button>
                    <button class="btn btn-ghost btn-icon" onclick="MPC.modules.team.del('${m.id}')">🗑️</button>
                  </div></td>
                </tr>`;
              }).join('')}
            </tbody></table>`}
          </div>`;
      },

      _form(m = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Name *</label>
              <input class="form-control" id="fName" value="${m.name||''}" required></div>
            <div class="form-group"><label>Role *</label>
              <input class="form-control" id="fRole" value="${m.role||''}" required placeholder="GP, Receptionist…"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Start Date</label>
              <input class="form-control" id="fStart" type="date" value="${m.start_date||''}"></div>
            <div class="form-group"><label>Contract Type</label>
              <select class="form-control" id="fContract">
                ${['Director','Employee','Contractor','Part-time','Volunteer'].map(c=>`<option${m.contract_type===c?' selected':''}>${c}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-group"><label>DBS Expiry</label>
            <input class="form-control" id="fDbs" type="date" value="${m.dbs_expiry||''}"></div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${m.notes||''}</textarea></div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Team Member', MPC.modules.team._form(), async () => {
          const name = document.getElementById('fName').value.trim();
          const role = document.getElementById('fRole').value.trim();
          if (!name || !role) throw new Error('Name and role required');
          await MPC.db.add('team_members', {
            name, role, contract_type: document.getElementById('fContract').value,
            start_date: document.getElementById('fStart').value || null,
            dbs_expiry: document.getElementById('fDbs').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Team member added');
          await MPC.modules.team.render();
        });
      },

      async edit(id) {
        const m = MPC.modules.team._data.find(x => x.id === id);
        if (!m) return;
        MPC.ui.showModal('Edit Team Member', MPC.modules.team._form(m), async () => {
          await MPC.db.update('team_members', id, {
            name: document.getElementById('fName').value.trim(),
            role: document.getElementById('fRole').value.trim(),
            contract_type: document.getElementById('fContract').value,
            start_date: document.getElementById('fStart').value || null,
            dbs_expiry: document.getElementById('fDbs').value || null,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Updated');
          await MPC.modules.team.render();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Remove this team member?');
        if (!ok) return;
        await MPC.db.delete('team_members', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.team.render();
      }
    },

    // ── FEEDBACK ─────────────────────────────────────────────────
    feedback: {
      _data: [],

      async render() {
        const rows = await MPC.db.getAll('patient_feedback', 'date', false);
        MPC.modules.feedback._data = rows;

        const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : 0;

        document.getElementById('pageContent').innerHTML = `
          <div class="stats-grid mb-24">
            <div class="stat-card" style="text-align:center">
              <div class="avg-rating">${avg}</div>
              <div class="stars" style="font-size:1.4rem;margin:4px 0">${MPC.fmt.stars(Math.round(avg))}</div>
              <div class="stat-label">Average Rating</div>
              <div class="stat-change">${rows.length} reviews</div>
            </div>
            ${['Google','Trustpilot','In-Clinic','Other'].map(p => {
              const pr = rows.filter(r => r.platform === p);
              const pavg = pr.length ? (pr.reduce((s,r)=>s+r.rating,0)/pr.length).toFixed(1) : '—';
              return `<div class="stat-card">
                <div class="stat-label">${p}</div>
                <div class="stat-value">${pavg}</div>
                <div class="stat-change">${pr.length} reviews</div>
              </div>`;
            }).join('')}
          </div>

          <div class="table-container">
            <div class="table-header">
              <span class="card-title">All Reviews</span>
              <button class="btn btn-primary btn-sm" onclick="MPC.modules.feedback.openAdd()">+ Add Review</button>
            </div>
            ${!rows.length ? `<div class="table-empty"><span class="empty-icon">⭐</span>No reviews yet.</div>` : `
            <table><thead><tr>
              <th>Platform</th><th>Rating</th><th>Review</th>
              <th>Date</th><th>Responded</th><th>Actions</th>
            </tr></thead><tbody>
              ${rows.map(r => `<tr>
                <td>${r.platform}</td>
                <td><span class="stars">${MPC.fmt.stars(r.rating)}</span></td>
                <td class="truncate" style="max-width:280px">${r.review_text||'—'}</td>
                <td>${MPC.fmt.date(r.date)}</td>
                <td>${MPC.fmt.statusBadge(r.responded ? 'Yes' : 'No')}</td>
                <td><div class="action-btns">
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.feedback.edit('${r.id}')">✏️</button>
                  <button class="btn btn-ghost btn-icon" onclick="MPC.modules.feedback.del('${r.id}')">🗑️</button>
                </div></td>
              </tr>`).join('')}
            </tbody></table>`}
          </div>`;
      },

      _form(r = {}) {
        return `
          <div class="form-row">
            <div class="form-group"><label>Platform</label>
              <select class="form-control" id="fPlatform">
                ${['Google','Trustpilot','In-Clinic','Other'].map(p=>`<option${r.platform===p?' selected':''}>${p}</option>`).join('')}
              </select></div>
            <div class="form-group"><label>Rating (1–5) *</label>
              <input class="form-control" id="fRating" type="number" min="1" max="5" value="${r.rating||5}" required></div>
          </div>
          <div class="form-group"><label>Review Text</label>
            <textarea class="form-control" id="fText" rows="4">${r.review_text||''}</textarea></div>
          <div class="form-row">
            <div class="form-group"><label>Date</label>
              <input class="form-control" id="fDate" type="date" value="${r.date||new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>Responded?</label>
              <select class="form-control" id="fResponded">
                <option value="false"${!r.responded?' selected':''}>No</option>
                <option value="true"${r.responded?' selected':''}>Yes</option>
              </select></div>
          </div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Review', MPC.modules.feedback._form(), async () => {
          const rating = parseInt(document.getElementById('fRating').value);
          if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be 1–5');
          await MPC.db.add('patient_feedback', {
            platform: document.getElementById('fPlatform').value,
            rating, review_text: document.getElementById('fText').value.trim(),
            date: document.getElementById('fDate').value,
            responded: document.getElementById('fResponded').value === 'true'
          });
          MPC.ui.showToast('Review added');
          await MPC.modules.feedback.render();
        });
      },

      async edit(id) {
        const r = MPC.modules.feedback._data.find(x => x.id === id);
        if (!r) return;
        MPC.ui.showModal('Edit Review', MPC.modules.feedback._form(r), async () => {
          await MPC.db.update('patient_feedback', id, {
            platform: document.getElementById('fPlatform').value,
            rating: parseInt(document.getElementById('fRating').value),
            review_text: document.getElementById('fText').value.trim(),
            date: document.getElementById('fDate').value,
            responded: document.getElementById('fResponded').value === 'true'
          });
          MPC.ui.showToast('Review updated');
          await MPC.modules.feedback.render();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Delete this review?');
        if (!ok) return;
        await MPC.db.delete('patient_feedback', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.feedback.render();
      }
    },

    // ── GOALS ────────────────────────────────────────────────────
    goals: {
      _data: [],

      async render() {
        const rows = await MPC.db.getAll('goals', 'created_at', false);
        MPC.modules.goals._data = rows;

        document.getElementById('pageContent').innerHTML = `
          <div class="section-header mb-24">
            <div>
              <div class="section-title">Goals</div>
              <div class="section-subtitle">Track monthly, quarterly and annual targets</div>
            </div>
            <button class="btn btn-primary" onclick="MPC.modules.goals.openAdd()">+ Add Goal</button>
          </div>
          ${rows.length === 0
            ? `<div class="card" style="text-align:center;padding:48px"><span style="font-size:2rem;opacity:.4">🎯</span><p class="text-muted mt-8">No goals yet. Add your first goal.</p></div>`
            : `<div class="goals-grid">${rows.map(g => MPC.modules.goals._card(g)).join('')}</div>`}`;
      },

      _card(g) {
        const pct = g.target_value > 0 ? Math.min(Math.round((g.current_value / g.target_value) * 100), 100) : 0;
        const fillCls = pct >= 100 ? 'success' : g.status === 'At Risk' ? 'warning' : g.status === 'Missed' ? 'danger' : '';
        const curr = g.unit === '£' ? MPC.fmt.money(g.current_value) : `${g.current_value} ${g.unit}`;
        const tgt  = g.unit === '£' ? MPC.fmt.money(g.target_value)  : `${g.target_value} ${g.unit}`;
        return `<div class="goal-card">
          <div class="goal-header">
            <div>
              <div class="goal-title">${g.title}</div>
              <div class="goal-period">${g.period} · ${g.category}</div>
            </div>
            ${MPC.fmt.statusBadge(g.status)}
          </div>
          <div class="goal-progress">
            <div class="progress-bar"><div class="progress-fill ${fillCls}" style="width:${pct}%"></div></div>
            <div class="goal-values">
              <span class="goal-current">${curr}</span>
              <span class="goal-target">of ${tgt} (${pct}%)</span>
            </div>
          </div>
          ${g.notes ? `<p class="text-sm text-muted mt-8">${g.notes}</p>` : ''}
          <div class="action-btns mt-8">
            <button class="btn btn-ghost btn-sm" onclick="MPC.modules.goals.edit('${g.id}')">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="MPC.modules.goals.del('${g.id}')">🗑️ Delete</button>
          </div>
        </div>`;
      },

      _form(g = {}) {
        return `
          <div class="form-group"><label>Goal Title *</label>
            <input class="form-control" id="fTitle" value="${g.title||''}" required placeholder="e.g. Patients Seen — April 2026"></div>
          <div class="form-row">
            <div class="form-group"><label>Period</label>
              <select class="form-control" id="fPeriod">
                ${['Monthly','Quarterly','Annual'].map(p=>`<option${g.period===p?' selected':''}>${p}</option>`).join('')}
              </select></div>
            <div class="form-group"><label>Category</label>
              <select class="form-control" id="fCat">
                ${['Revenue','Patients','Marketing','Operations','Other'].map(c=>`<option${g.category===c?' selected':''}>${c}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Target Value *</label>
              <input class="form-control" id="fTarget" type="number" min="0" step="any" value="${g.target_value||''}" required></div>
            <div class="form-group"><label>Current Value</label>
              <input class="form-control" id="fCurrent" type="number" min="0" step="any" value="${g.current_value||0}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Unit</label>
              <input class="form-control" id="fUnit" value="${g.unit||'£'}" placeholder="£, patients, reviews…"></div>
            <div class="form-group"><label>Status</label>
              <select class="form-control" id="fStatus">
                ${['On Track','At Risk','Completed','Missed'].map(s=>`<option${g.status===s?' selected':''}>${s}</option>`).join('')}
              </select></div>
          </div>
          <div class="form-group"><label>Notes</label>
            <textarea class="form-control" id="fNotes">${g.notes||''}</textarea></div>`;
      },

      openAdd() {
        MPC.ui.showModal('Add Goal', MPC.modules.goals._form(), async () => {
          const title = document.getElementById('fTitle').value.trim();
          const target = parseFloat(document.getElementById('fTarget').value);
          if (!title || !target) throw new Error('Title and target required');
          await MPC.db.add('goals', {
            title, period: document.getElementById('fPeriod').value,
            category: document.getElementById('fCat').value,
            target_value: target,
            current_value: parseFloat(document.getElementById('fCurrent').value)||0,
            unit: document.getElementById('fUnit').value.trim() || '£',
            status: document.getElementById('fStatus').value,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Goal added');
          await MPC.modules.goals.render();
        });
      },

      async edit(id) {
        const g = MPC.modules.goals._data.find(x => x.id === id);
        if (!g) return;
        MPC.ui.showModal('Edit Goal', MPC.modules.goals._form(g), async () => {
          await MPC.db.update('goals', id, {
            title: document.getElementById('fTitle').value.trim(),
            period: document.getElementById('fPeriod').value,
            category: document.getElementById('fCat').value,
            target_value: parseFloat(document.getElementById('fTarget').value)||0,
            current_value: parseFloat(document.getElementById('fCurrent').value)||0,
            unit: document.getElementById('fUnit').value.trim(),
            status: document.getElementById('fStatus').value,
            notes: document.getElementById('fNotes').value.trim()
          });
          MPC.ui.showToast('Goal updated');
          await MPC.modules.goals.render();
        });
      },

      async del(id) {
        const ok = await MPC.ui.confirm('Delete this goal?');
        if (!ok) return;
        await MPC.db.delete('goals', id);
        MPC.ui.showToast('Deleted', 'warning');
        await MPC.modules.goals.render();
      }
    },

    // ── SETTINGS ─────────────────────────────────────────────────
    settings: {
      async render() {
        const mask = (s) => {
          if (!s || s === 'YOUR_SUPABASE_URL_HERE' || s === 'YOUR_SUPABASE_ANON_KEY_HERE') return '⚠️ Not configured';
          if (s.length <= 12) return s;
          return s.slice(0, 8) + '••••••••' + s.slice(-4);
        };

        document.getElementById('pageContent').innerHTML = `
          <div class="settings-section">
            <h3>Supabase Configuration</h3>
            <div class="config-item">
              <span class="config-key">Project URL</span>
              <span class="config-val">${mask(SUPABASE_URL)}</span>
            </div>
            <div class="config-item">
              <span class="config-key">Anon Key</span>
              <span class="config-val">${mask(SUPABASE_ANON_KEY)}</span>
            </div>
            <div class="divider"></div>
            <div class="info-box">
              To update credentials, open <code>admin/config.js</code> and replace the placeholder values with your Supabase project URL and anon key. Find them at <code>app.supabase.com → Settings → API</code>.
            </div>
          </div>

          <div class="settings-section">
            <h3>Database Setup</h3>
            <div class="info-box">
              Run <code>admin/supabase-setup.sql</code> in the Supabase SQL Editor to create all required tables. Then go to <code>Authentication → Users</code> and create your admin login.
            </div>
          </div>

          <div class="settings-section">
            <h3>Account</h3>
            <p class="text-muted text-sm mb-16">Signed in as <strong>${MPC.currentUser?.email || 'Unknown'}</strong></p>
            <button class="btn btn-danger" onclick="MPC.modules.settings.logout()">Sign Out</button>
          </div>

          <div class="settings-section">
            <h3>About</h3>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <span class="version-badge">🏥 MyPrivateClinic Admin v1.0</span>
              <span class="text-muted text-sm">Built for Dr Faizal Secretary's private GP clinic, Preston</span>
            </div>
            <p class="text-muted text-sm mt-8">Deployed on Vercel · Powered by Supabase</p>
          </div>`;
      },

      async logout() {
        await MPC.supabase.auth.signOut();
        window.location.href = 'login.html';
      }
    }

  } // end modules
};

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => MPC.init());
