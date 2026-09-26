// ==========================================
// GLOBAL STATE MANAGEMENT
// ==========================================
const safeJsonParse = (value, fallback = []) => {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const state = {
  cart: safeJsonParse(localStorage.getItem('cart'), []),
  currentUser: safeJsonParse(localStorage.getItem('currentUser'), null),
  selectedService: null,
  orders: safeJsonParse(localStorage.getItem('orders'), []),
  bookings: safeJsonParse(localStorage.getItem('bookings'), [])
};

const PRIMARY_ADMIN_UID = 'a854c1f9-292f-49ac-89c0-37dd509e683d';
const ADMIN_ROUTES = [
  '/dashboard/dashboard.html',
  '/admin-billing/admin-billing.html',
  '/admin-projects/admin-projects.html',
  '/bookkeeping/bookkeeping.html',
  '/queue/queue.html'
];

const currentPath = window.location.pathname.toLowerCase();
const isAdminRoute = ADMIN_ROUTES.some(route => currentPath.endsWith(route));
if (isAdminRoute) {
  document.documentElement.style.visibility = 'hidden';
}

window.safeJsonParse = safeJsonParse;

window.getSupabaseClient = function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = 'https://rpfclpfipqspbdbanobj.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU';
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return window.supabaseClient || null;
};

window.resolveUserRole = async function resolveUserRole(userOverride = null) {
  const db = window.getSupabaseClient ? window.getSupabaseClient() : null;
  const resolvedUser = userOverride || (db ? (await db.auth.getSession())?.data?.session?.user || null : null);

  if (!resolvedUser) {
    return { isAdmin: false, role: 'client', email: '', user: null };
  }

  const email = (resolvedUser.email || '').trim().toLowerCase();
  if (resolvedUser.id === PRIMARY_ADMIN_UID) {
    return { isAdmin: true, role: 'admin', email, user: resolvedUser };
  }

  if (db) {
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', resolvedUser.id)
        .maybeSingle();

      const dbRole = String(profile?.role || 'client').toLowerCase();
      if (dbRole === 'admin') {
        return { isAdmin: true, role: 'admin', email, user: resolvedUser };
      }
    } catch {
      // ignore profile lookup errors; default to client access
    }
  }

  return { isAdmin: false, role: 'client', email, user: resolvedUser };
};

window.requireAdminAccess = async function requireAdminAccess({ redirectTo = '/index.html' } = {}) {
  const roleInfo = await window.resolveUserRole();

  if (!roleInfo.isAdmin) {
    if (redirectTo) {
      window.location.href = redirectTo;
    }
    return false;
  }

  document.documentElement.style.visibility = '';
  return true;
};

window.escapeHtml = function (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.isSafeExternalUrl = function (url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

window.sanitizeUrl = function (url, fallback = '#') {
  return window.isSafeExternalUrl(url) ? url : fallback;
};

if (isAdminRoute) {
  const checkAdminRoute = async () => {
    const isAllowed = await window.requireAdminAccess();
    if (!isAllowed) {
      console.warn('Blocked unauthorized admin route access:', currentPath);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAdminRoute, { once: true });
  } else {
    checkAdminRoute();
  }
}
