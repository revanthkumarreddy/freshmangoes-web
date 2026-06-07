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
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'orders', label: 'My Orders', icon: '📦' },
  { id: 'track', label: 'Track Order', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  APPROVED: { bg: '#dcfce7', text: '#166534', label: 'Confirmed' },
  PAID: { bg: '#dcfce7', text: '#166534', label: 'Paid' },
  FULFILLED: { bg: '#dbeafe', text: '#1e40af', label: 'Shipped' },
  PARTIALLY_FULFILLED: { bg: '#fef3c7', text: '#92400e', label: 'Partially Shipped' },
  NOT_FULFILLED: { bg: '#fef3c7', text: '#92400e', label: 'Processing' },
  CANCELED: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
  PENDING: { bg: '#f3f4f6', text: '#374151', label: 'Pending' },
  UNDEFINED: { bg: '#f3f4f6', text: '#374151', label: 'Unknown' },
};

function getStatusBadge(status: string | undefined) {
  const s = STATUS_COLORS[status || 'UNDEFINED'] || STATUS_COLORS.UNDEFINED;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        background: s.bg,
        color: s.text,
      }}
    >
      {s.label}
    </span>
  );
}

/** Get local user from localStorage (from our custom login). */
function getLocalUser() {
  try {
    const raw = localStorage.getItem('fm:user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Check if user is authenticated via any method. */
function isAuthenticated(): boolean {
  return isLoggedIn() || !!getLocalUser();
}

/* ------------------------------------------------------------------ */
/* Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function AccountDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [localUser, setLocalUser] = useState<any>(null);
  const [wixMember, setWixMember] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.replace(`${BASE}/login`);
    }
  }, []);

  // Load user profile (local + Wix)
  useEffect(() => {
    (async () => {
      setLoadingProfile(true);
      // Local user
      const lu = getLocalUser();
      setLocalUser(lu);

      // Try Wix member profile if logged in via Wix
      if (isLoggedIn()) {
        try {
          const { member } = await wixClient.members.getCurrentMember({
            fieldsets: ['FULL'],
          });
          setWixMember(member ?? null);
        } catch {
          /* not a Wix member */
        }
      }
      setLoadingProfile(false);
    })();
  }, []);

  // Fetch orders from Wix (works with visitor tokens too — shows orders linked to current session)
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const result = await wixClient.orders.searchOrders({ search: {} });
      setOrders(result.orders || []);
    } catch (err) {
      console.error('[FreshMangos] fetch orders error:', err);
      setOrders([]);
    }
    setLoadingOrders(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Logout handler
  async function handleLogout() {
    // Clear local auth
    localStorage.removeItem('fm:user');
    localStorage.removeItem('wix:member_name');

    // Clear Wix auth if present
    if (isLoggedIn()) {
      try {
        const { logoutUrl } = await wixClient.auth.logout(window.location.href);
        localStorage.removeItem('wix:tokens');
        window.dispatchEvent(new Event('auth:updated'));
        window.location.href = logoutUrl;
        return;
      } catch {
        localStorage.removeItem('wix:tokens');
      }
    }

    window.dispatchEvent(new Event('auth:updated'));
    window.location.replace(`${BASE}/`);
  }

  // Derive display info from local user or Wix member
  const memberName =
    wixMember?.contact?.firstName ||
    wixMember?.profile?.nickname ||
    localUser?.name ||
    'Mango Lover';

  const memberEmail =
    wixMember?.loginEmail ||
    wixMember?.contact?.emails?.[0] ||
    localUser?.email ||
    '';

  const memberPhone =
    wixMember?.contact?.phones?.[0] ||
    localUser?.phone ||
    '';

  const memberSince =
    wixMember?._createdDate ||
    localUser?.createdAt;

  const initials = memberName.charAt(0).toUpperCase();

  if (!isAuthenticated()) return null;

  return (
    <div style={{ background: 'var(--color-cream)', minHeight: 'calc(100vh - 68px)' }}>
      {/* Hero Banner */}
      <div className="account-hero">
        <div className="container-x" style={{ position: 'relative', zIndex: 1 }}>
          <div className="account-hero-inner">
            <div className="account-avatar">{initials}</div>
            <div>
              <h1 className="display" style={{ fontSize: '2rem', marginBottom: '0.25rem', color: 'var(--color-cream)' }}>
                {loadingProfile ? 'Loading…' : `Welcome back, ${memberName}`}
              </h1>
              <p style={{ fontSize: '0.85rem', opacity: 0.8, color: 'var(--color-cream)' }}>
                {memberEmail}{memberSince ? ` · Member since ${fmtDate(memberSince)}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="container-x">
        <nav className="account-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`account-tab ${activeTab === tab.id ? 'account-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="account-tab-icon">{tab.icon}</span>
              <span className="account-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="container-x" style={{ paddingBottom: '4rem' }}>
        {activeTab === 'overview' && (
          <OverviewTab
            memberName={memberName}
            orders={orders}
            loadingOrders={loadingOrders}
            onTabChange={setActiveTab}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} loading={loadingOrders} onRefresh={fetchOrders} />
        )}
        {activeTab === 'track' && (
          <TrackOrderTab orders={orders} loading={loadingOrders} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            memberName={memberName}
            memberEmail={memberEmail}
            memberPhone={memberPhone}
            memberSince={memberSince}
            wixMember={wixMember}
            localUser={localUser}
            loading={loadingProfile}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* OVERVIEW TAB                                                         */
/* ================================================================== */
function OverviewTab({
  memberName,
  orders,
  loadingOrders,
  onTabChange,
}: {
  memberName: string;
  orders: any[];
  loadingOrders: boolean;
  onTabChange: (t: TabId) => void;
}) {
  const recentOrders = orders.slice(0, 3);
  const totalSpent = orders.reduce((sum, o) => {
    const amt = o?.priceSummary?.totalPrice?.amount;
    return sum + (amt ? parseFloat(amt) : 0);
  }, 0);

  return (
    <div className="account-content">
      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-value">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{fmt(totalSpent)}</div>
          <div className="stat-label">Total Spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🥭</div>
          <div className="stat-value">
            {orders.reduce((sum, o) => sum + ((o as any)?.lineItems?.length || 0), 0)}
          </div>
          <div className="stat-label">Items Ordered</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <a href={`${BASE}/shop`} className="action-card">
          <span className="action-icon">🛒</span>
          <span className="action-label">Shop Mangoes</span>
        </a>
        <button onClick={() => onTabChange('orders')} className="action-card">
          <span className="action-icon">📋</span>
          <span className="action-label">View All Orders</span>
        </button>
        <button onClick={() => onTabChange('track')} className="action-card">
          <span className="action-icon">🔍</span>
          <span className="action-label">Track an Order</span>
        </button>
        <button onClick={() => onTabChange('settings')} className="action-card">
          <span className="action-icon">⚙️</span>
          <span className="action-label">Account Settings</span>
        </button>
      </div>

      {/* Recent Orders */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="display section-title">Recent Orders</h2>
          {orders.length > 3 && (
            <button className="section-link" onClick={() => onTabChange('orders')}>
              View all →
            </button>
          )}
        </div>
        {loadingOrders ? (
          <p style={{ opacity: 0.6, padding: '1.5rem 0' }}>Loading orders…</p>
        ) : recentOrders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🥭</span>
            <p className="empty-title">No orders yet</p>
            <p className="empty-desc">Your first box of sunshine is just a click away!</p>
            <a href={`${BASE}/shop`} className="btn btn-saffron" style={{ marginTop: '1rem' }}>
              Browse our mangoes
            </a>
          </div>
        ) : (
          <div className="orders-list">
            {recentOrders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* ORDERS TAB                                                           */
/* ================================================================== */
function OrdersTab({
  orders,
  loading,
  onRefresh,
}: {
  orders: any[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('all');

  const filteredOrders =
    filter === 'all'
      ? orders
      : orders.filter((o) => o.fulfillmentStatus === filter);

  return (
    <div className="account-content">
      <div className="section-card">
        <div className="section-header">
          <h2 className="display section-title">My Orders</h2>
          <button onClick={onRefresh} className="section-link" style={{ fontSize: '0.85rem' }}>
            ↻ Refresh
          </button>
        </div>

        {/* Filter pills */}
        <div className="filter-pills">
          {[
            { value: 'all', label: 'All' },
            { value: 'NOT_FULFILLED', label: 'Processing' },
            { value: 'FULFILLED', label: 'Shipped' },
            { value: 'CANCELED', label: 'Cancelled' },
          ].map((f) => (
            <button
              key={f.value}
              className={`filter-pill ${filter === f.value ? 'filter-pill-active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ opacity: 0.6, padding: '1.5rem 0' }}>Loading orders…</p>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📦</span>
            <p className="empty-title">
              {filter === 'all' ? 'No orders yet' : 'No orders match this filter'}
            </p>
            <p className="empty-desc">
              {filter === 'all'
                ? 'Time to treat yourself to some fresh mangoes!'
                : 'Try a different filter or browse all orders.'}
            </p>
            {filter === 'all' && (
              <a href={`${BASE}/shop`} className="btn btn-saffron" style={{ marginTop: '1rem' }}>
                Start shopping
              </a>
            )}
          </div>
        ) : (
          <div className="orders-list">
            {filteredOrders.map((order) => (
              <OrderCard key={order._id} order={order} showItems />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* ORDER CARD                                                           */
/* ================================================================== */
function OrderCard({ order, showItems = false }: { order: any; showItems?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const lineItems: any[] = order?.lineItems || [];
  const orderNum = order?.number || order?._id?.slice(-6) || '—';
  const dateStr = fmtDate(order?._createdDate || order?.dateCreated);
  const total = order?.priceSummary?.totalPrice?.amount;
  const status = order?.fulfillmentStatus || order?.status;
  const paymentStatus = order?.paymentStatus;

  return (
    <div className="order-card">
      <div className="order-card-top">
        <div className="order-card-info">
          <div className="order-number">Order #{orderNum}</div>
          <div className="order-date">{dateStr}</div>
        </div>
        <div className="order-card-right">
          {getStatusBadge(status)}
          <div className="order-total">{fmt(total)}</div>
        </div>
      </div>

      {paymentStatus && paymentStatus !== status && (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>Payment: </span>
          {getStatusBadge(paymentStatus)}
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="order-items-preview">
          {lineItems.slice(0, expanded || showItems ? lineItems.length : 2).map((li: any, i: number) => (
            <div key={i} className="order-item-row">
              {li.image && (
                <img src={li.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                  {li.productName?.translated || li.productName?.original || 'Item'}
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.6 }}>Qty: {li.quantity}</div>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {fmt(li.totalPriceAfterTax?.amount || li.price?.amount)}
              </div>
            </div>
          ))}
          {!showItems && lineItems.length > 2 && (
            <button
              className="section-link"
              onClick={() => setExpanded(!expanded)}
              style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}
            >
              {expanded ? 'Show less' : `+${lineItems.length - 2} more items`}
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
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
    const q = query.trim().replace('#', '');
    if (!q) return;
    const found = orders.find(
      (o) => String(o.number) === q || o._id === q || o._id?.endsWith(q)
    );
    setResult(found || null);
  }

  const trackingSteps = [
    { key: 'placed', label: 'Order Placed', icon: '✓' },
    { key: 'confirmed', label: 'Confirmed', icon: '✓' },
    { key: 'shipped', label: 'Shipped', icon: '🚚' },
    { key: 'delivered', label: 'Delivered', icon: '📬' },
  ];

  function getActiveStep(order: any): number {
    const status = order?.fulfillmentStatus;
    const payStatus = order?.paymentStatus;
    if (status === 'FULFILLED') return 4;
    if (status === 'PARTIALLY_FULFILLED') return 3;
    if (payStatus === 'PAID' || payStatus === 'APPROVED' || status === 'NOT_FULFILLED') return 2;
    if (status === 'CANCELED') return 0;
    return 1;
  }

  return (
    <div className="account-content">
      <div className="section-card">
        <h2 className="display section-title" style={{ marginBottom: '0.5rem' }}>Track Your Order</h2>
        <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem' }}>
          Enter your order number to see its current status and delivery progress.
        </p>

        <form onSubmit={handleSearch} className="track-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter order number (e.g. 10001)"
            className="track-input"
          />
          <button type="submit" className="btn btn-saffron" style={{ whiteSpace: 'nowrap' }}>
            Track Order
          </button>
        </form>

        {searched && !result && (
          <div className="empty-state" style={{ marginTop: '2rem' }}>
            <span className="empty-icon">🔍</span>
            <p className="empty-title">Order not found</p>
            <p className="empty-desc">
              Double-check your order number and try again. You can find it in your order confirmation email.
            </p>
          </div>
        )}

        {result && (
          <div style={{ marginTop: '2rem' }}>
            <OrderCard order={result} showItems />
            {result.fulfillmentStatus !== 'CANCELED' && (
              <div className="tracking-timeline">
                <h3 className="display" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                  Delivery Progress
                </h3>
                <div className="timeline-steps">
                  {trackingSteps.map((step, i) => {
                    const active = i < getActiveStep(result);
                    const current = i === getActiveStep(result) - 1;
                    return (
                      <div
                        key={step.key}
                        className={`timeline-step ${active ? 'timeline-step-active' : ''} ${current ? 'timeline-step-current' : ''}`}
                      >
                        <div className={`timeline-dot ${active ? 'timeline-dot-active' : ''}`}>
                          {active ? step.icon : (i + 1)}
                        </div>
                        <div className="timeline-label">{step.label}</div>
                        {i < trackingSteps.length - 1 && (
                          <div className={`timeline-line ${active ? 'timeline-line-active' : ''}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {result.fulfillmentStatus === 'CANCELED' && (
              <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#fee2e2', borderRadius: '1rem', textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.25rem' }}>This order was cancelled</p>
                <p style={{ fontSize: '0.8rem', color: '#991b1b', opacity: 0.8 }}>If you have questions, contact our support team at freshmangoes.in@gmail.com or +91 9844763416.</p>
              </div>
            )}
          </div>
        )}

        {!searched && orders.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 className="display" style={{ fontSize: '1.15rem', marginBottom: '1rem', opacity: 0.7 }}>
              Or select a recent order:
            </h3>
            <div className="orders-list">
              {orders.slice(0, 5).map((order) => (
                <button
                  key={order._id}
                  className="order-quick-pick"
                  onClick={() => {
                    setQuery(String(order.number || order._id?.slice(-6)));
                    setResult(order);
                    setSearched(true);
                  }}
                >
                  <span style={{ fontWeight: 600 }}>#{order.number || order._id?.slice(-6)}</span>
                  <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>{fmtDate(order._createdDate)}</span>
                  <span>{getStatusBadge(order.fulfillmentStatus)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!searched && orders.length === 0 && !loading && (
          <div className="empty-state" style={{ marginTop: '2rem' }}>
            <span className="empty-icon">📦</span>
            <p className="empty-title">No orders to track</p>
            <p className="empty-desc">Place your first order to start tracking!</p>
            <a href={`${BASE}/shop`} className="btn btn-saffron" style={{ marginTop: '1rem' }}>Shop now</a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* SETTINGS TAB                                                         */
/* ================================================================== */
function SettingsTab({
  memberName,
  memberEmail,
  memberPhone,
  memberSince,
  wixMember,
  localUser,
  loading,
  onLogout,
}: {
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  memberSince: string | undefined;
  wixMember: any;
  localUser: any;
  loading: boolean;
  onLogout: () => void;
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(memberName);
  const [editPhone, setEditPhone] = useState(memberPhone);
  const [saved, setSaved] = useState(false);

  if (loading) {
    return (
      <div className="account-content">
        <div className="section-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <p style={{ opacity: 0.6 }}>Loading profile…</p>
        </div>
      </div>
    );
  }

  function handleSaveProfile() {
    if (!localUser) return;
    const updated = { ...localUser, name: editName, phone: editPhone };
    localStorage.setItem('fm:user', JSON.stringify(updated));
    localStorage.setItem('wix:member_name', editName);

    // Update in users list too
    try {
      const users = JSON.parse(localStorage.getItem('fm:users') || '[]');
      const idx = users.findIndex((u: any) => u.id === localUser.id);
      if (idx >= 0) {
        users[idx] = updated;
        localStorage.setItem('fm:users', JSON.stringify(users));
      }
    } catch {}

    setEditMode(false);
    setSaved(true);
    window.dispatchEvent(new Event('auth:updated'));
    setTimeout(() => setSaved(false), 2500);
  }

  const address = wixMember?.contact?.addresses?.[0];
  const isLocalOnly = !wixMember && !!localUser;

  return (
    <div className="account-content">
      {/* Profile Card */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="display section-title">Profile Information</h2>
          {isLocalOnly && !editMode && (
            <button className="section-link" onClick={() => { setEditMode(true); setEditName(memberName); setEditPhone(memberPhone); }}>
              ✏️ Edit
            </button>
          )}
        </div>

        {saved && (
          <div style={{ padding: '0.6rem 1rem', background: '#dcfce7', borderRadius: '0.5rem', fontSize: '0.82rem', color: '#166534', fontWeight: 500, marginBottom: '1rem' }}>
            ✓ Profile updated successfully!
          </div>
        )}

        {!editMode ? (
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Full Name</label>
              <div className="settings-value">{memberName}</div>
            </div>
            <div className="settings-field">
              <label className="settings-label">Email Address</label>
              <div className="settings-value">{memberEmail || '—'}</div>
            </div>
            <div className="settings-field">
              <label className="settings-label">Phone</label>
              <div className="settings-value">{memberPhone || 'Not provided'}</div>
            </div>
            <div className="settings-field">
              <label className="settings-label">Member Since</label>
              <div className="settings-value">{fmtDate(memberSince)}</div>
            </div>
          </div>
        ) : (
          <div className="settings-edit-form">
            <div className="form-field-inline">
              <label className="settings-label">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="settings-edit-input"
              />
            </div>
            <div className="form-field-inline">
              <label className="settings-label">Email Address</label>
              <input type="email" value={memberEmail} className="settings-edit-input" disabled style={{ opacity: 0.5 }} />
              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Email cannot be changed</span>
            </div>
            <div className="form-field-inline">
              <label className="settings-label">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="settings-edit-input"
                placeholder="+91 98765 43210"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-saffron" style={{ flex: 1, padding: '0.7rem' }} onClick={handleSaveProfile}>
                Save Changes
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '0.7rem' }} onClick={() => setEditMode(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {address && (
          <>
            <h3 className="display" style={{ fontSize: '1.2rem', marginTop: '2rem', marginBottom: '1rem' }}>Saved Address</h3>
            <div className="address-card">
              {[
                address.addressLine1 || address.streetAddress?.name,
                address.addressLine2,
                [address.city, address.subdivision].filter(Boolean).join(', '),
                [address.postalCode, address.country].filter(Boolean).join(' — '),
              ].filter(Boolean).map((line, i) => (
                <div key={i} style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{line}</div>
              ))}
            </div>
          </>
        )}

        {isLocalOnly && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-saffron-50)', borderRadius: '0.75rem', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>
            💡 <strong>Tip:</strong> Connect your Wix account via Google for enhanced features like saved addresses and order sync across devices.
          </div>
        )}
      </div>

      {/* Account Actions */}
      <div className="section-card" style={{ marginTop: '1.5rem' }}>
        <h2 className="display section-title">Quick Links</h2>
        <div className="account-actions-list">
          <a href={`${BASE}/shop`} className="account-action-item">
            <span className="action-item-icon">🛒</span>
            <div>
              <div className="action-item-title">Continue Shopping</div>
              <div className="action-item-desc">Browse our fresh mango selection</div>
            </div>
            <span className="action-item-arrow">→</span>
          </a>
          <a href={`${BASE}/contact`} className="account-action-item">
            <span className="action-item-icon">💬</span>
            <div>
              <div className="action-item-title">Contact Support</div>
              <div className="action-item-desc">Get help with orders or products</div>
            </div>
            <span className="action-item-arrow">→</span>
          </a>
          <a href={`${BASE}/faq`} className="account-action-item">
            <span className="action-item-icon">❓</span>
            <div>
              <div className="action-item-title">FAQ & Shipping</div>
              <div className="action-item-desc">Common questions and shipping info</div>
            </div>
            <span className="action-item-arrow">→</span>
          </a>
        </div>
      </div>

      {/* Logout */}
      <div className="section-card" style={{ marginTop: '1.5rem', borderColor: '#fee2e2' }}>
        <h2 className="display section-title" style={{ color: '#991b1b' }}>Sign Out</h2>
        <p className="section-desc">
          You will be logged out and redirected to the homepage. Your cart will be preserved.
        </p>
        {!showLogoutConfirm ? (
          <button
            className="btn btn-ghost"
            style={{ borderColor: '#fca5a5', color: '#991b1b', marginTop: '0.5rem' }}
            onClick={() => setShowLogoutConfirm(true)}
          >
            Sign out of my account
          </button>
        ) : (
          <div className="logout-confirm">
            <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Are you sure you want to sign out?</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn" onClick={onLogout} style={{ flex: 1, background: '#991b1b', color: 'white', borderRadius: '999px' }}>
                Yes, sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
