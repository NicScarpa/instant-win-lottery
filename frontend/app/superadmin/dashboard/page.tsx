'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '../../lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  customDomain: string | null;
  plan: string;
  licenseStatus: string;
  licenseEnd: string | null;
  adminEmail: string;
  companyName: string | null;
  createdAt: string;
  _count: {
    promotions: number;
    staffUsers: number;
  };
}

interface AnalyticsOverview {
  tenantCount: number;
  totalPromotions: number;
  activePromotions: number;
  totalTokens: number;
  totalPlays: number;
  totalWins: number;
  totalCustomers: number;
  winRate: string | number;
}

interface TopTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  licenseStatus: string;
  promotionCount: number;
  totalPlays: number;
  totalTokens: number;
}

interface Analytics {
  overview: AnalyticsOverview;
  tenantsByPlan: Array<{ plan: string; _count: { id: number } }>;
  tenantsByStatus: Array<{ licenseStatus: string; _count: { id: number } }>;
  topTenants: TopTenant[];
}

interface NewTenantForm {
  name: string;
  slug: string;
  subdomain: string;
  adminEmail: string;
  companyName: string;
  plan: string;
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTenant, setNewTenant] = useState<NewTenantForm>({
    name: '',
    slug: '',
    subdomain: '',
    adminEmail: '',
    companyName: '',
    plan: 'starter'
  });
  const [createError, setCreateError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit tenant modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    customDomain: '',
    adminEmail: '',
    companyName: '',
    plan: 'starter',
    maxPromotions: 1,
    maxTokensPerPromo: 500,
    maxStaffUsers: 2
  });
  const [editError, setEditError] = useState('');

  const router = useRouter();

  const getToken = () => localStorage.getItem('superadmin_token');

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace('/superadmin/login');
      return;
    }

    try {
      const [tenantsRes, analyticsRes] = await Promise.all([
        fetch(getApiUrl('api/superadmin/tenants'), {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        }),
        fetch(getApiUrl('api/superadmin/analytics'), {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        })
      ]);

      if (!tenantsRes.ok || !analyticsRes.ok) {
        if (tenantsRes.status === 401 || analyticsRes.status === 401) {
          localStorage.removeItem('superadmin_token');
          router.replace('/superadmin/login');
          return;
        }
        throw new Error('Failed to fetch data');
      }

      const [tenantsData, analyticsData] = await Promise.all([
        tenantsRes.json(),
        analyticsRes.json()
      ]);

      setTenants(tenantsData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError('Error loading data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    router.replace('/superadmin/login');
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setActionLoading('create');

    const token = getToken();
    try {
      const res = await fetch(getApiUrl('api/superadmin/tenants'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(newTenant)
      });

      const data = await res.json();

      if (res.ok) {
        setShowCreateModal(false);
        setNewTenant({ name: '', slug: '', subdomain: '', adminEmail: '', companyName: '', plan: 'starter' });
        fetchData();
      } else {
        setCreateError(data.error || 'Failed to create tenant');
      }
    } catch (err) {
      setCreateError('Connection error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateLicense = async (tenantId: string, plan: string) => {
    setActionLoading(tenantId);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/superadmin/tenants/${tenantId}/activate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ plan, durationDays: 365 })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (tenantId: string) => {
    if (!confirm('Are you sure you want to suspend this tenant?')) return;

    setActionLoading(tenantId);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/superadmin/tenants/${tenantId}/suspend`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (tenantId: string) => {
    setActionLoading(tenantId);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/superadmin/tenants/${tenantId}/reactivate`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    if (!confirm(`Vuoi accedere come admin di "${tenantName}"? Verrai reindirizzato alla dashboard del tenant.`)) return;

    setActionLoading(tenantId);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/superadmin/tenants/${tenantId}/impersonate`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        // Salva il token di impersonation come admin_token
        localStorage.setItem('admin_token', data.token);
        // Salva info per mostrare banner di impersonation
        localStorage.setItem('impersonation_info', JSON.stringify({
          tenantName: data.tenant.name,
          tenantSlug: data.tenant.slug
        }));
        // Redirect alla dashboard admin
        router.push('/admin/dashboard');
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Impersonation failed');
      }
    } catch (err) {
      console.error(err);
      alert('Errore durante impersonation');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      customDomain: tenant.customDomain || '',
      adminEmail: tenant.adminEmail,
      companyName: tenant.companyName || '',
      plan: tenant.plan,
      maxPromotions: 1, // Will be fetched
      maxTokensPerPromo: 500,
      maxStaffUsers: 2
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    setEditError('');
    setActionLoading('edit');
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/superadmin/tenants/${editingTenant.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editForm.name,
          customDomain: editForm.customDomain || null,
          adminEmail: editForm.adminEmail,
          companyName: editForm.companyName || null,
          plan: editForm.plan
        })
      });

      const data = await res.json();

      if (res.ok) {
        setShowEditModal(false);
        setEditingTenant(null);
        fetchData();
      } else {
        setEditError(data.error || 'Failed to update tenant');
      }
    } catch (err) {
      setEditError('Connection error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-900/50 text-green-300 border-green-700',
      trial: 'bg-blue-900/50 text-blue-300 border-blue-700',
      suspended: 'bg-red-900/50 text-red-300 border-red-700',
      expired: 'bg-gray-700 text-gray-300 border-gray-600'
    };
    return colors[status] || colors.expired;
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      starter: 'bg-gray-700 text-gray-300',
      pro: 'bg-purple-900/50 text-purple-300',
      enterprise: 'bg-yellow-900/50 text-yellow-300'
    };
    return colors[plan] || colors.starter;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Instant Win Platform Management</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div className="bg-red-900/50 text-red-300 p-4 rounded mb-6 border border-red-800">
            {error}
          </div>
        )}

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold">{analytics.overview.tenantCount}</div>
              <div className="text-gray-400 text-sm">Tenants</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold">{analytics.overview.totalPromotions}</div>
              <div className="text-gray-400 text-sm">Promozioni</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold text-green-400">{analytics.overview.activePromotions}</div>
              <div className="text-gray-400 text-sm">Attive</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold">{analytics.overview.totalTokens.toLocaleString()}</div>
              <div className="text-gray-400 text-sm">Token</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold">{analytics.overview.totalPlays.toLocaleString()}</div>
              <div className="text-gray-400 text-sm">Giocate</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold text-yellow-400">{analytics.overview.totalWins.toLocaleString()}</div>
              <div className="text-gray-400 text-sm">Vincite</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold">{analytics.overview.totalCustomers.toLocaleString()}</div>
              <div className="text-gray-400 text-sm">Clienti</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-3xl font-bold text-blue-400">{analytics.overview.winRate}%</div>
              <div className="text-gray-400 text-sm">Win Rate</div>
            </div>
          </div>
        )}

        {/* Plan, Status Distribution & Top Tenants */}
        {analytics && (
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-3">Per Piano</h3>
              <div className="space-y-2">
                {analytics.tenantsByPlan.map(item => (
                  <div key={item.plan} className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded text-xs ${getPlanBadge(item.plan)}`}>
                      {item.plan.toUpperCase()}
                    </span>
                    <span className="font-mono">{item._count.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-3">Per Status</h3>
              <div className="space-y-2">
                {analytics.tenantsByStatus.map(item => (
                  <div key={item.licenseStatus} className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(item.licenseStatus)}`}>
                      {item.licenseStatus.toUpperCase()}
                    </span>
                    <span className="font-mono">{item._count.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-3">Top Tenants per Giocate</h3>
              <div className="space-y-2">
                {analytics.topTenants.slice(0, 5).map((tenant, idx) => (
                  <div key={tenant.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs w-4">{idx + 1}.</span>
                      <span className="text-sm truncate max-w-[120px]">{tenant.name}</span>
                    </div>
                    <span className="font-mono text-sm text-blue-400">{tenant.totalPlays.toLocaleString()}</span>
                  </div>
                ))}
                {analytics.topTenants.length === 0 && (
                  <p className="text-gray-500 text-sm">Nessuna giocata ancora</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tenants Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Tenants</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
            >
              + New Tenant
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Domain</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Plan</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Promos</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Expires</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-700/30">
                    <td className="p-4">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-gray-400 text-xs">{tenant.adminEmail}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{tenant.subdomain}.instantwin.io</div>
                      {tenant.customDomain && (
                        <div className="text-gray-400 text-xs">{tenant.customDomain}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${getPlanBadge(tenant.plan)}`}>
                        {tenant.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(tenant.licenseStatus)}`}>
                        {tenant.licenseStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      {tenant._count.promotions}
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {tenant.licenseEnd
                        ? new Date(tenant.licenseEnd).toLocaleDateString('it-IT')
                        : '-'
                      }
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        {/* Edit - sempre disponibile */}
                        <button
                          onClick={() => openEditModal(tenant)}
                          disabled={actionLoading === tenant.id}
                          className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs disabled:opacity-50"
                          title="Modifica tenant"
                        >
                          Edit
                        </button>
                        {/* Impersonate - sempre disponibile per tenant attivi o trial */}
                        {(tenant.licenseStatus === 'active' || tenant.licenseStatus === 'trial') && (
                          <button
                            onClick={() => handleImpersonate(tenant.id, tenant.name)}
                            disabled={actionLoading === tenant.id}
                            className="bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded text-xs disabled:opacity-50"
                            title="Accedi come admin di questo tenant"
                          >
                            Impersonate
                          </button>
                        )}
                        {tenant.licenseStatus === 'trial' && (
                          <button
                            onClick={() => handleActivateLicense(tenant.id, tenant.plan)}
                            disabled={actionLoading === tenant.id}
                            className="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-xs disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {tenant.licenseStatus === 'suspended' && (
                          <button
                            onClick={() => handleReactivate(tenant.id)}
                            disabled={actionLoading === tenant.id}
                            className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-xs disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                        {(tenant.licenseStatus === 'active' || tenant.licenseStatus === 'trial') && (
                          <button
                            onClick={() => handleSuspend(tenant.id)}
                            disabled={actionLoading === tenant.id}
                            className="bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-xs disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Create New Tenant</h2>

            {createError && (
              <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm border border-red-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Slug *</label>
                  <input
                    type="text"
                    value={newTenant.slug}
                    onChange={(e) => setNewTenant({
                      ...newTenant,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                    placeholder="my-company"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Plan</label>
                  <select
                    value={newTenant.plan}
                    onChange={(e) => setNewTenant({ ...newTenant, plan: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Admin Email *</label>
                <input
                  type="email"
                  value={newTenant.adminEmail}
                  onChange={(e) => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Legal Company Name</label>
                <input
                  type="text"
                  value={newTenant.companyName}
                  onChange={(e) => setNewTenant({ ...newTenant, companyName: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                />
              </div>

              <div className="bg-gray-700/50 p-3 rounded text-sm text-gray-400">
                Subdomain: <strong className="text-white">{newTenant.slug || 'example'}.instantwin.io</strong>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded disabled:opacity-50"
                >
                  {actionLoading === 'create' ? 'Creating...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {showEditModal && editingTenant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Tenant: {editingTenant.name}</h2>

            {editError && (
              <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm border border-red-800">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Custom Domain</label>
                <input
                  type="text"
                  value={editForm.customDomain}
                  onChange={(e) => setEditForm({ ...editForm, customDomain: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  placeholder="lottery.example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lascia vuoto per usare il subdomain: {editingTenant.subdomain}.instantwin.io
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Admin Email *</label>
                <input
                  type="email"
                  value={editForm.adminEmail}
                  onChange={(e) => setEditForm({ ...editForm, adminEmail: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Legal Company Name</label>
                <input
                  type="text"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Plan</label>
                <select
                  value={editForm.plan}
                  onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="bg-gray-700/50 p-3 rounded text-sm space-y-1">
                <div className="text-gray-400">
                  Subdomain: <span className="text-white">{editingTenant.subdomain}.instantwin.io</span>
                </div>
                {editForm.customDomain && (
                  <div className="text-gray-400">
                    Custom: <span className="text-green-400">{editForm.customDomain}</span>
                  </div>
                )}
                <div className="text-gray-400">
                  License: <span className={editingTenant.licenseStatus === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                    {editingTenant.licenseStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingTenant(null); }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'edit'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded disabled:opacity-50"
                >
                  {actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
