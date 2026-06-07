import { useState, useEffect, useCallback } from 'react';
import { wixClient, isLoggedIn } from '~/lib/wix-client';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

const fmt = (amount: string | number | undefined) => {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);
};

const fmtDate = (d: string | undefined | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

type TabId = 'overview' | 'orders' | 'track' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: '🏠' },
  { id: 'orders',    label: 'Orders',    icon: '📦' },
  { id: 'track',     label: 'Track',     icon: '🔍' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  APPROVED:           { bg: '#dcfce7', text: '#166534', label: 'Confirmed' },
  PAID:               { bg: '#dcfce7', text: '#166534', label: 'Paid' },
  FULFILLED:          { bg: '#dbeafe', text: '#1e40af', label: 'Shipped' },
  PARTIALLY_FULFILLED:{ bg: '#fef3c7', text: '#92400e', label: 'Part. Shipped' },
  NOT_FULFILLED:      { bg: '#fef3c7', text: '#92400e', label: 'Processing' },
  CANCELED:           { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
  PENDING:            { bg: '#f3f4f6', text: '#374151', label: 'Pending' },
  UNDEFINED:          { bg: '#f3f4f6', text: '#374151', label: 'Unknown' },
};

function getStatusBadge(status: string | undefined) {
  const s = STATUS_COLORS[status || 'UNDEFINED'] || STATUS_COLORS.UNDEFINED;
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.03em',
      background: s.bg, color: s.text,
    }}>
      {s.label}
    </span>
  );
}

function getLocalUser() {
  try { return JSON.parse(localStorage.getItem('fm:user') || 'null') ?? null; }
  catch { return null; }
}

function isAuthenticated() { return isLoggedIn() || !!getLocalUser(); }

/* ------------------------------------------------------------------ */
/* Shared styles (injected once via <style> tag approach via JS)        */
/* ------------------------------------------------------------------ */
const css = `
  .acc-wrap { background: var(--color-cream); min-height: calc(100vh - 60px); }

  /* ── Hero ── */
  .acc-hero {
    background: linear-gradient(135deg, var(--color-leaf-700) 0%, var(--color-leaf-600) 60%, #1a4d2e 100%);
    padding: 1.25rem 1rem 1.5rem;
    position: relative; overflow: hidden;
  }
  .acc-hero::after {
    content:''; position:absolute; top:-60px; right:-60px;
    width:200px; height:200px; border-radius:50%;
    background: radial-gradient(circle, rgba(237,155,20,0.18), transparent 70%);
    pointer-events:none;
  }
  .acc-hero-inner { display:flex; align-items:center; gap:0.85rem; position:relative; z-index:1; }
  .acc-avatar {
    width:3rem; height:3rem; border-radius:50%; flex-shrink:0;
    background: linear-gradient(135deg, var(--color-saffron-400), var(--color-saffron-500));
    color: var(--color-ink); display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:1.25rem;
    box-shadow: 0 4px 14px -4px rgba(237,155,20,0.5);
  }
  .acc-hero-name {
    font-family: var(--font-display); font-size:1.4rem; font-weight:500;
    color:#fff; margin:0 0 0.15rem; line-height:1.2;
  }
  .acc-hero-meta { font-size:0.72rem; color:rgba(255,255,255,0.65); margin:0; }

  /* ── Tab bar ── */
  .acc-tabs {
    display:flex; background:#fff; border-bottom:1px solid rgba(0,0,0,0.06);
    overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;
    position:sticky; top:60px; z-index:30;
  }
  .acc-tabs::-webkit-scrollbar { display:none; }
  .acc-tab {
    flex:1; min-width:64px; display:flex; flex-direction:column; align-items:center;
    gap:0.2rem; padding:0.7rem 0.5rem 0.6rem;
    border:none; background:transparent; cursor:pointer;
    font-family:var(--font-sans); color:var(--color-ink-soft);
    border-bottom:2.5px solid transparent; transition:all 0.18s; white-space:nowrap;
  }
  .acc-tab-icon { font-size:1.15rem; line-height:1; }
  .acc-tab-label { font-size:0.62rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }
  .acc-tab-active { color:var(--color-saffron-600); border-bottom-color:var(--color-saffron-500); }

  /* ── Content wrapper ── */
  .acc-content { padding:1rem 1rem 5rem; max-width:680px; margin:0 auto; }

  /* ── Stat strip (3-up horizontal) ── */
  .acc-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; margin-bottom:1rem; }
  .acc-stat {
    background:#fff; border:1px solid rgba(0,0,0,0.05); border-radius:1rem;
    padding:0.85rem 0.5rem; text-align:center;
    box-shadow:0 2px 8px -4px rgba(0,0,0,0.06);
  }
  .acc-stat-icon { font-size:1.4rem; display:block; margin-bottom:0.3rem; }
  .acc-stat-value { font-family:var(--font-display); font-size:1.4rem; font-weight:600; line-height:1; }
  .acc-stat-label { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.1em; opacity:0.5; margin-top:0.2rem; }

  /* ── Quick action grid ── */
  .acc-actions { display:grid; grid-template-columns:repeat(2,1fr); gap:0.6rem; margin-bottom:1rem; }
  .acc-action {
    display:flex; flex-direction:column; align-items:center; gap:0.4rem;
    padding:1rem 0.5rem; border-radius:1rem; background:#fff;
    border:1px solid rgba(0,0,0,0.06); cursor:pointer;
    text-decoration:none; color:var(--color-ink); font-family:var(--font-sans);
    transition:all 0.18s;
  }
  .acc-action:hover { border-color:var(--color-saffron-400); box-shadow:0 4px 16px -6px rgba(237,155,20,0.2); transform:translateY(-1px); }
  .acc-action-icon { font-size:1.5rem; }
  .acc-action-label { font-size:0.75rem; font-weight:600; text-align:center; }

  /* ── Section card ── */
  .acc-card {
    background:#fff; border:1px solid rgba(0,0,0,0.05); border-radius:1.25rem;
    padding:1.25rem; box-shadow:0 2px 10px -4px rgba(0,0,0,0.06); margin-bottom:0.85rem;
  }
  .acc-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
  .acc-card-title { font-family:var(--font-display); font-size:1.2rem; font-weight:500; margin:0; }
  .acc-link-btn { font-size:0.78rem; font-weight:600; color:var(--color-saffron-600); background:none; border:none; cursor:pointer; font-family:var(--font-sans); }

  /* ── Order card ── */
  .acc-order { border:1px solid rgba(0,0,0,0.07); border-radius:0.85rem; padding:1rem; margin-bottom:0.6rem; transition:border-color 0.2s; }
  .acc-order:hover { border-color:var(--color-saffron-300); }
  .acc-order-row { display:flex; justify-content:space-between; align-items:flex-start; }
  .acc-order-num { font-weight:700; font-size:0.9rem; }
  .acc-order-date { font-size:0.7rem; opacity:0.5; margin-top:0.1rem; }
  .acc-order-total { font-family:var(--font-display); font-size:1.05rem; font-weight:600; text-align:right; }
  .acc-order-items { margin-top:0.6rem; padding-top:0.6rem; border-top:1px solid rgba(0,0,0,0.05); }
  .acc-item-row { display:flex; align-items:center; gap:0.6rem; padding:0.35rem 0; }

  /* ── Settings ── */
  .acc-fields { display:flex; flex-direction:column; gap:0.6rem; }
  .acc-field { padding:0.85rem 1rem; border:1px solid rgba(0,0,0,0.07); border-radius:0.75rem; background:var(--color-saffron-50); }
  .acc-field-label { font-size:0.65rem; text-transform:uppercase; letter-spacing:0.12em; opacity:0.5; margin-bottom:0.25rem; font-weight:600; display:block; }
  .acc-field-value { font-size:0.9rem; font-weight:500; }
  .acc-edit-input {
    width:100%; padding:0.7rem 0.9rem; border:1.5px solid rgba(0,0,0,0.1); border-radius:0.65rem;
    font-size:0.9rem; font-family:var(--font-sans); outline:none; background:#fff; box-sizing:border-box;
    transition:border-color 0.2s;
  }
  .acc-edit-input:focus { border-color:var(--color-saffron-400); }

  /* ── Track ── */
  .track-row { display:flex; gap:0.6rem; }
  .track-input {
    flex:1; border:1.5px solid rgba(0,0,0,0.1); border-radius:999px;
    padding:0.75rem 1rem; font-size:0.9rem; outline:none; font-family:var(--font-sans);
    transition:border-color 0.2s;
  }
  .track-input:focus { border-color:var(--color-saffron-400); }

  /* ── Timeline ── */
  .timeline { display:flex; align-items:flex-start; justify-content:space-between; position:relative; margin-top:1.25rem; }
  .tl-step { display:flex; flex-direction:column; align-items:center; flex:1; text-align:center; }
  .tl-dot {
    width:2.25rem; height:2.25rem; border-radius:50%; background:rgba(0,0,0,0.06);
    display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700;
    color:var(--color-ink-soft); position:relative; z-index:2; transition:all 0.3s;
  }
  .tl-dot-active { background:var(--color-leaf-600); color:#fff; box-shadow:0 4px 12px -4px rgba(30,107,58,0.4); }
  .tl-label { margin-top:0.4rem; font-size:0.62rem; font-weight:500; opacity:0.5; }
  .tl-step-active .tl-label { opacity:1; font-weight:700; }
  .tl-line {
    position:absolute; top:1.1rem; left:calc(50% + 1.1rem); right:calc(-50% + 1.1rem);
    height:2.5px; background:rgba(0,0,0,0.08); z-index:1;
  }
  .tl-line-active { background:var(--color-leaf-600); }

  /* ── Empty state ── */
  .acc-empty { text-align:center; padding:2rem 1rem; }
  .acc-empty-icon { font-size:2.5rem; display:block; margin-bottom:0.6rem; }
  .acc-empty-title { font-family:var(--font-display); font-size:1.2rem; margin-bottom:0.3rem; }
  .acc-empty-desc { font-size:0.82rem; opacity:0.6; max-width:260px; margin:0 auto; line-height:1.5; }

  /* ── Filter pills ── */
  .filter-row { display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:1rem; }
  .fpill {
    padding:0.35rem 0.85rem; border-radius:999px; border:1px solid rgba(0,0,0,0.12);
    background:transparent; font-size:0.75rem; font-weight:500; cursor:pointer;
    transition:all 0.15s; font-family:var(--font-sans); color:var(--color-ink-soft);
  }
  .fpill:hover { border-color:var(--color-ink); color:var(--color-ink); }
  .fpill-active { background:var(--color-ink) !important; color:var(--color-cream) !important; border-color:var(--color-ink) !important; }

  /* ── Logout confirm ── */
  .logout-confirm { background:#fff5f5; border-radius:0.75rem; padding:1rem; border:1px solid #fecaca; margin-top:0.75rem; }
`;

function InjectStyles() {
  useEffect(() => {
    if (document.getElementById('acc-styles')) return;
    const el = document.createElement('style');
    el.id = 'acc-styles';
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

/* ------------------------------------------------------------------ */
/* Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function AccountDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [localUser, setLocalUser]   = useState<any>(null);
  const [wixMember, setWixMember]   = useState<any>(null);
  const [orders, setOrders]         = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingOrders,  setLoadingOrders]  = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) window.location.replace(`${BASE}/login`);
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingProfile(true);
      const lu = getLocalUser();
      setLocalUser(lu);
      if (isLoggedIn()) {
        try {
          const { member } = await wixClient.members.getCurrentMember({ fieldsets: ['FULL'] });
          setWixMember(member ?? null);
        } catch {}
      }
      setLoadingProfile(false);
    })();
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const result = await wixClient.orders.searchOrders({ search: {} });
      setOrders(result.orders || []);
    } catch { setOrders([]); }
    setLoadingOrders(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleLogout() {
    localStorage.removeItem('fm:user');
    localStorage.removeItem('wix:member_name');
    if (isLoggedIn()) {
      try {
        const { logoutUrl } = await wixClient.auth.logout(window.location.href);
        localStorage.removeItem('wix:tokens');
        window.dispatchEvent(new Event('auth:updated'));
        window.location.href = logoutUrl;
        return;
      } catch { localStorage.removeItem('wix:tokens'); }
    }
    window.dispatchEvent(new Event('auth:updated'));
    window.location.replace(`${BASE}/`);
  }

  const memberName  = wixMember?.contact?.firstName || wixMember?.profile?.nickname || localUser?.name || 'Mango Lover';
  const memberEmail = wixMember?.loginEmail || wixMember?.contact?.emails?.[0] || localUser?.email || '';
  const memberPhone = wixMember?.contact?.phones?.[0] || localUser?.phone || '';
  const memberSince = wixMember?._createdDate || localUser?.createdAt;
  const initials    = memberName.charAt(0).toUpperCase();

  if (!isAuthenticated()) return null;

  return (
    <>
      <InjectStyles />
      <div className="acc-wrap">
        {/* ── Compact Hero ── */}
        <div className="acc-hero">
          <div className="acc-hero-inner" style={{ maxWidth: 680, margin: '0 auto' }}>
            <div className="acc-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <p className="acc-hero-name">
                {loadingProfile ? 'Loading…' : `Welcome back, ${memberName}`}
              </p>
              <p className="acc-hero-meta">
                {memberEmail}{memberSince ? ` · Member since ${fmtDate(memberSince)}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── Sticky Tab Bar ── */}
        <nav className="acc-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`acc-tab${activeTab === t.id ? ' acc-tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span className="acc-tab-icon">{t.icon}</span>
              <span className="acc-tab-label">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className="acc-content">
          {activeTab === 'overview' && (
            <OverviewTab memberName={memberName} orders={orders} loadingOrders={loadingOrders} onTabChange={setActiveTab} />
          )}
          {activeTab === 'orders' && (
            <OrdersTab orders={orders} loading={loadingOrders} onRefresh={fetchOrders} />
          )}
          {activeTab === 'track' && (
            <TrackOrderTab orders={orders} loading={loadingOrders} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              memberName={memberName} memberEmail={memberEmail} memberPhone={memberPhone}
              memberSince={memberSince} wixMember={wixMember} localUser={localUser}
              loading={loadingProfile} onLogout={handleLogout}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/* OVERVIEW TAB                                                         */
/* ================================================================== */
function OverviewTab({ memberName, orders, loadingOrders, onTabChange }: {
  memberName: string; orders: any[]; loadingOrders: boolean; onTabChange: (t: TabId) => void;
}) {
  const recentOrders = orders.slice(0, 3);
  const totalSpent   = orders.reduce((s, o) => s + parseFloat(o?.priceSummary?.totalPrice?.amount || '0'), 0);
  const totalItems   = orders.reduce((s, o) => s + ((o as any)?.lineItems?.length || 0), 0);

  return (
    <>
      {/* 3-up compact stat strip */}
      <div className="acc-stats">
        <div className="acc-stat">
          <span className="acc-stat-icon">📦</span>
          <div className="acc-stat-value">{orders.length}</div>
          <div className="acc-stat-label">Orders</div>
        </div>
        <div className="acc-stat">
          <span className="acc-stat-icon">💰</span>
          <div className="acc-stat-value" style={{ fontSize: orders.length ? '1.1rem' : '1.4rem' }}>{fmt(totalSpent)}</div>
          <div className="acc-stat-label">Spent</div>
        </div>
        <div className="acc-stat">
          <span className="acc-stat-icon">🥭</span>
          <div className="acc-stat-value">{totalItems}</div>
          <div className="acc-stat-label">Items</div>
        </div>
      </div>

      {/* 2-up quick actions */}
      <div className="acc-actions">
        <a href={`${BASE}/shop`} className="acc-action">
          <span className="acc-action-icon">🛒</span>
          <span className="acc-action-label">Shop Mangoes</span>
        </a>
        <button onClick={() => onTabChange('orders')} className="acc-action">
          <span className="acc-action-icon">📋</span>
          <span className="acc-action-label">My Orders</span>
        </button>
        <button onClick={() => onTabChange('track')} className="acc-action">
          <span className="acc-action-icon">🔍</span>
          <span className="acc-action-label">Track Order</span>
        </button>
        <button onClick={() => onTabChange('settings')} className="acc-action">
          <span className="acc-action-icon">⚙️</span>
          <span className="acc-action-label">Settings</span>
        </button>
      </div>

      {/* Recent orders */}
      <div className="acc-card">
        <div className="acc-card-header">
          <h2 className="acc-card-title">Recent Orders</h2>
          {orders.length > 3 && (
            <button className="acc-link-btn" onClick={() => onTabChange('orders')}>See all →</button>
          )}
        </div>
        {loadingOrders ? (
          <p style={{ opacity: 0.5, fontSize: '0.85rem', padding: '1rem 0' }}>Loading orders…</p>
        ) : recentOrders.length === 0 ? (
          <div className="acc-empty">
            <span className="acc-empty-icon">🥭</span>
            <p className="acc-empty-title">No orders yet</p>
            <p className="acc-empty-desc">Your first box of sunshine is just a click away!</p>
            <a href={`${BASE}/shop`} className="btn btn-saffron" style={{ marginTop: '1rem', display: 'inline-flex' }}>Browse mangoes</a>
          </div>
        ) : (
          recentOrders.map(o => <OrderCard key={o._id} order={o} />)
        )}
      </div>
    </>
  );
}

/* ================================================================== */
/* ORDERS TAB                                                           */
/* ================================================================== */
function OrdersTab({ orders, loading, onRefresh }: { orders: any[]; loading: boolean; onRefresh: () => void; }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? orders : orders.filter(o => o.fulfillmentStatus === filter);

  return (
    <div className="acc-card">
      <div className="acc-card-header">
        <h2 className="acc-card-title">My Orders</h2>
        <button onClick={onRefresh} className="acc-link-btn">↻ Refresh</button>
      </div>
      <div className="filter-row">
        {[{ v: 'all', l: 'All' }, { v: 'NOT_FULFILLED', l: 'Processing' }, { v: 'FULFILLED', l: 'Shipped' }, { v: 'CANCELED', l: 'Cancelled' }].map(f => (
          <button key={f.v} className={`fpill${filter === f.v ? ' fpill-active' : ''}`} onClick={() => setFilter(f.v)}>{f.l}</button>
        ))}
      </div>
      {loading ? (
        <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Loading orders…</p>
      ) : filtered.length === 0 ? (
        <div className="acc-empty">
          <span className="acc-empty-icon">📦</span>
          <p className="acc-empty-title">{filter === 'all' ? 'No orders yet' : 'No orders match'}</p>
          <p className="acc-empty-desc">{filter === 'all' ? 'Time to treat yourself to some fresh mangoes!' : 'Try a different filter.'}</p>
          {filter === 'all' && <a href={`${BASE}/shop`} className="btn btn-saffron" style={{ marginTop: '1rem', display: 'inline-flex' }}>Start shopping</a>}
        </div>
      ) : (
        filtered.map(o => <OrderCard key={o._id} order={o} showItems />)
      )}
    </div>
  );
}

/* ================================================================== */
/* ORDER CARD                                                           */
/* ================================================================== */
function OrderCard({ order, showItems = false }: { order: any; showItems?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const lineItems: any[] = order?.lineItems || [];
  const orderNum  = order?.number || order?._id?.slice(-6) || '—';
  const dateStr   = fmtDate(order?._createdDate || order?.dateCreated);
  const total     = order?.priceSummary?.totalPrice?.amount;
  const status    = order?.fulfillmentStatus || order?.status;

  return (
    <div className="acc-order">
      <div className="acc-order-row">
        <div>
          <div className="acc-order-num">#{orderNum}</div>
          <div className="acc-order-date">{dateStr}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {getStatusBadge(status)}
          <div className="acc-order-total">{fmt(total)}</div>
        </div>
      </div>
      {lineItems.length > 0 && (
        <div className="acc-order-items">
          {lineItems.slice(0, expanded || showItems ? lineItems.length : 2).map((li: any, i: number) => (
            <div key={i} className="acc-item-row">
              {li.image && <img src={li.image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {li.productName?.translated || li.productName?.original || 'Item'}
                </div>
                <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>Qty: {li.quantity}</div>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>
                {fmt(li.totalPriceAfterTax?.amount || li.price?.amount)}
              </div>
            </div>
          ))}
          {!showItems && lineItems.length > 2 && (
            <button className="acc-link-btn" onClick={() => setExpanded(!expanded)} style={{ marginTop: '0.35rem', display: 'block' }}>
              {expanded ? 'Show less' : `+${lineItems.length - 2} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* TRACK ORDER TAB                                                      */
/* ================================================================== */
function TrackOrderTab({ orders, loading }: { orders: any[]; loading: boolean }) {
  const [query, setQuery]     = useState('');
  const [result, setResult]   = useState<any | null>(null);
  const [searched, setSearched] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
    const q = query.trim().replace('#', '');
    if (!q) return;
    setResult(orders.find(o => String(o.number) === q || o._id === q || o._id?.endsWith(q)) || null);
  }

  const steps = [
    { key: 'placed',    label: 'Placed',    icon: '✓' },
    { key: 'confirmed', label: 'Confirmed', icon: '✓' },
    { key: 'shipped',   label: 'Shipped',   icon: '🚚' },
    { key: 'delivered', label: 'Delivered', icon: '📬' },
  ];

  function getStep(o: any) {
    const fs = o?.fulfillmentStatus, ps = o?.paymentStatus;
    if (fs === 'FULFILLED') return 4;
    if (fs === 'PARTIALLY_FULFILLED') return 3;
    if (ps === 'PAID' || ps === 'APPROVED' || fs === 'NOT_FULFILLED') return 2;
    if (fs === 'CANCELED') return 0;
    return 1;
  }

  return (
    <div className="acc-card">
      <h2 className="acc-card-title" style={{ marginBottom: '0.4rem' }}>Track Your Order</h2>
      <p style={{ fontSize: '0.82rem', opacity: 0.55, marginBottom: '1rem' }}>
        Enter your order number to check status and delivery progress.
      </p>
      <form onSubmit={handleSearch} className="track-row">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Order number (e.g. 10001)" className="track-input" />
        <button type="submit" className="btn btn-saffron" style={{ whiteSpace: 'nowrap', padding: '0.7rem 1rem' }}>Track</button>
      </form>

      {searched && !result && (
        <div className="acc-empty" style={{ marginTop: '1.5rem' }}>
          <span className="acc-empty-icon">🔍</span>
          <p className="acc-empty-title">Order not found</p>
          <p className="acc-empty-desc">Double-check your order number and try again.</p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <OrderCard order={result} showItems />
          {result.fulfillmentStatus !== 'CANCELED' && (
            <div style={{ background: 'var(--color-saffron-50)', borderRadius: '0.85rem', padding: '1.25rem', marginTop: '1rem' }}>
              <h3 className="display" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Delivery Progress</h3>
              <div className="timeline">
                {steps.map((s, i) => {
                  const active  = i < getStep(result);
                  const current = i === getStep(result) - 1;
                  return (
                    <div key={s.key} className={`tl-step${active ? ' tl-step-active' : ''}${current ? ' tl-step-current' : ''}`}>
                      <div className={`tl-dot${active ? ' tl-dot-active' : ''}`}>{active ? s.icon : i + 1}</div>
                      <div className="tl-label">{s.label}</div>
                      {i < steps.length - 1 && <div className={`tl-line${active ? ' tl-line-active' : ''}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!searched && orders.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.75rem' }}>Or pick a recent order:</p>
          {orders.slice(0, 5).map(o => (
            <button key={o._id} onClick={() => { setQuery(String(o.number || o._id?.slice(-6))); setResult(o); setSearched(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.8rem 1rem',
                       border: '1px solid rgba(0,0,0,0.07)', borderRadius: '0.75rem', background: '#fff', cursor: 'pointer',
                       fontFamily: 'var(--font-sans)', marginBottom: '0.5rem', transition: 'all 0.15s' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>#{o.number || o._id?.slice(-6)}</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.55 }}>{fmtDate(o._createdDate)}</span>
              <span style={{ marginLeft: 'auto' }}>{getStatusBadge(o.fulfillmentStatus)}</span>
            </button>
          ))}
        </div>
      )}

      {!searched && orders.length === 0 && !loading && (
        <div className="acc-empty" style={{ marginTop: '1.5rem' }}>
          <span className="acc-empty-icon">📦</span>
          <p className="acc-empty-title">No orders to track</p>
          <p className="acc-empty-desc">Place your first order to start tracking!</p>
          <a href={`${BASE}/shop`} className="btn btn-saffron" style={{ marginTop: '1rem', display: 'inline-flex' }}>Shop now</a>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* SETTINGS TAB                                                         */
/* ================================================================== */
function SettingsTab({ memberName, memberEmail, memberPhone, memberSince, wixMember, localUser, loading, onLogout }: {
  memberName: string; memberEmail: string; memberPhone: string; memberSince: string | undefined;
  wixMember: any; localUser: any; loading: boolean; onLogout: () => void;
}) {
  const [showLogout, setShowLogout] = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [editName, setEditName]     = useState(memberName);
  const [editPhone, setEditPhone]   = useState(memberPhone);
  const [saved, setSaved]           = useState(false);
  const isLocalOnly = !wixMember && !!localUser;

  if (loading) return (
    <div className="acc-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
      <p style={{ opacity: 0.5 }}>Loading profile…</p>
    </div>
  );

  function handleSave() {
    if (!localUser) return;
    const updated = { ...localUser, name: editName, phone: editPhone };
    localStorage.setItem('fm:user', JSON.stringify(updated));
    localStorage.setItem('wix:member_name', editName);
    try {
      const users = JSON.parse(localStorage.getItem('fm:users') || '[]');
      const idx = users.findIndex((u: any) => u.id === localUser.id);
      if (idx >= 0) { users[idx] = updated; localStorage.setItem('fm:users', JSON.stringify(users)); }
    } catch {}
    setEditMode(false); setSaved(true);
    window.dispatchEvent(new Event('auth:updated'));
    setTimeout(() => setSaved(false), 2500);
  }

  const address = wixMember?.contact?.addresses?.[0];

  return (
    <>
      {/* Profile card */}
      <div className="acc-card">
        <div className="acc-card-header">
          <h2 className="acc-card-title">Profile</h2>
          {isLocalOnly && !editMode && (
            <button className="acc-link-btn" onClick={() => { setEditMode(true); setEditName(memberName); setEditPhone(memberPhone); }}>
              ✏️ Edit
            </button>
          )}
        </div>
        {saved && (
          <div style={{ padding: '0.55rem 1rem', background: '#dcfce7', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#166534', fontWeight: 600, marginBottom: '0.85rem' }}>
            ✓ Profile updated!
          </div>
        )}
        {!editMode ? (
          <div className="acc-fields">
            <div className="acc-field"><span className="acc-field-label">Full Name</span><div className="acc-field-value">{memberName}</div></div>
            <div className="acc-field"><span className="acc-field-label">Email</span><div className="acc-field-value" style={{ wordBreak: 'break-all' }}>{memberEmail || '—'}</div></div>
            <div className="acc-field"><span className="acc-field-label">Phone</span><div className="acc-field-value">{memberPhone || 'Not provided'}</div></div>
            <div className="acc-field"><span className="acc-field-label">Member Since</span><div className="acc-field-value">{fmtDate(memberSince)}</div></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div><label className="acc-field-label">Full Name</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="acc-edit-input" /></div>
            <div><label className="acc-field-label">Email</label><input type="email" value={memberEmail} className="acc-edit-input" disabled style={{ opacity: 0.5 }} /><span style={{ fontSize: '0.68rem', opacity: 0.5 }}>Email cannot be changed</span></div>
            <div><label className="acc-field-label">Phone</label><input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="acc-edit-input" placeholder="+91 98765 43210" /></div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
              <button className="btn btn-saffron" style={{ flex: 1, padding: '0.7rem' }} onClick={handleSave}>Save</button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '0.7rem' }} onClick={() => setEditMode(false)}>Cancel</button>
            </div>
          </div>
        )}
        {address && (
          <>
            <h3 className="display" style={{ fontSize: '1rem', marginTop: '1.25rem', marginBottom: '0.75rem' }}>Saved Address</h3>
            <div className="acc-field">
              {[address.addressLine1 || address.streetAddress?.name, address.addressLine2,
                [address.city, address.subdivision].filter(Boolean).join(', '),
                [address.postalCode, address.country].filter(Boolean).join(' — ')
              ].filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{l}</div>)}
            </div>
          </>
        )}
        {isLocalOnly && (
          <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'var(--color-saffron-50)', borderRadius: '0.75rem', fontSize: '0.78rem', color: 'var(--color-ink-soft)' }}>
            💡 <strong>Tip:</strong> Connect your Google account via Wix for enhanced features like saved addresses.
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="acc-card">
        <h2 className="acc-card-title" style={{ marginBottom: '0.75rem' }}>Quick Links</h2>
        {[
          { href: `${BASE}/shop`, icon: '🛒', title: 'Continue Shopping', desc: 'Browse our fresh mango selection' },
          { href: `${BASE}/contact`, icon: '💬', title: 'Contact Support', desc: 'Get help with orders or products' },
          { href: `${BASE}/faq`, icon: '❓', title: 'FAQ & Shipping', desc: 'Common questions and shipping info' },
        ].map(l => (
          <a key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 0',
            borderBottom: '1px solid rgba(0,0,0,0.05)', textDecoration: 'none', color: 'var(--color-ink)' }}>
            <span style={{ fontSize: '1.25rem' }}>{l.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{l.title}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '0.1rem' }}>{l.desc}</div>
            </div>
            <span style={{ opacity: 0.3 }}>→</span>
          </a>
        ))}
      </div>

      {/* Sign Out */}
      <div className="acc-card" style={{ borderColor: '#fee2e2' }}>
        <h2 className="acc-card-title" style={{ color: '#991b1b', marginBottom: '0.35rem' }}>Sign Out</h2>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.75rem' }}>
          You'll be logged out and redirected to the homepage.
        </p>
        {!showLogout ? (
          <button className="btn btn-ghost" style={{ borderColor: '#fca5a5', color: '#991b1b' }} onClick={() => setShowLogout(true)}>
            Sign out of my account
          </button>
        ) : (
          <div className="logout-confirm">
            <p style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>Are you sure you want to sign out?</p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '0.7rem' }} onClick={() => setShowLogout(false)}>Cancel</button>
              <button className="btn" style={{ flex: 1, padding: '0.7rem', background: '#991b1b', color: '#fff', borderRadius: '999px' }} onClick={onLogout}>Yes, sign out</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
