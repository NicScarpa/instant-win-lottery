'use client';
import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../../lib/api';

interface StaffUser {
  id: number;
  username: string;
  role: string;
  created_at: string;
  _count: {
    redeemed_prizes: number;
  };
}

interface TenantLimits {
  plan: string;
  staffUsers: {
    used: number;
    max: number;
  };
}

interface StaffManagerProps {
  refreshKey?: number;
}

export default function StaffManager({ refreshKey }: StaffManagerProps) {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [limits, setLimits] = useState<TenantLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'staff' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Password reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLink, setResetLink] = useState('');
  const [resetting, setResetting] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const getToken = () => localStorage.getItem('admin_token');

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const [staffRes, limitsRes] = await Promise.all([
        fetch(getApiUrl('api/admin/staff'), {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        }),
        fetch(getApiUrl('api/admin/tenant-limits'), {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        })
      ]);

      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffUsers(data);
      }

      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setLimits(data);
      }
    } catch (err) {
      setError('Errore nel caricamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'staff' });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (user: StaffUser) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', role: user.role });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const token = getToken();

    try {
      const url = editingUser
        ? getApiUrl(`api/admin/staff/${editingUser.id}`)
        : getApiUrl('api/admin/staff');

      const method = editingUser ? 'PUT' : 'POST';

      // Per edit, non inviare password se vuota
      const body = editingUser && !formData.password
        ? { username: formData.username, role: formData.role }
        : formData;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        setFormError(data.error || 'Errore nel salvataggio');
      }
    } catch (err) {
      setFormError('Errore di connessione');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: number) => {
    setDeleting(true);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/admin/staff/${userId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Errore nella eliminazione');
      }
    } catch (err) {
      alert('Errore di connessione');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async (userId: number) => {
    setResetting(userId);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl(`api/admin/staff/${userId}/reset-password`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      const data = await res.json();

      if (res.ok) {
        // Costruisci il link completo
        const baseUrl = window.location.origin;
        const fullLink = `${baseUrl}/reset-password?token=${data.resetToken}`;
        setResetLink(fullLink);
        setShowResetModal(true);
        setCopySuccess(false);
      } else {
        alert(data.error || 'Errore nella generazione del link');
      }
    } catch (err) {
      alert('Errore di connessione');
    } finally {
      setResetting(null);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const canAddMore = limits ? limits.staffUsers.used < limits.staffUsers.max : true;

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/50">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-white/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gestione Staff</h2>
          {limits && (
            <p className="text-sm text-gray-500 mt-1">
              {limits.staffUsers.used} / {limits.staffUsers.max} utenti ({limits.plan})
            </p>
          )}
        </div>
        <button
          onClick={openCreateModal}
          disabled={!canAddMore}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            canAddMore
              ? 'bg-[#b42a28] text-white hover:brightness-110 shadow-lg shadow-[#b42a28]/20'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          + Nuovo Staff
        </button>
      </div>

      {!canAddMore && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm">
          Hai raggiunto il limite di utenti staff per il tuo piano. Contatta il supporto per un upgrade.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Staff List */}
      {staffUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>Nessun utente staff creato</p>
          <p className="text-sm mt-1">Crea il primo utente per abilitare la redemption dei premi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffUsers.map(user => (
            <div
              key={user.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow gap-3"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{user.username}</div>
                  <div className="text-xs text-gray-500">
                    Creato il {new Date(user.created_at).toLocaleDateString('it-IT')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-14 sm:ml-0">
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadge(user.role)}`}>
                  {user.role.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {user._count.redeemed_prizes} redemption
                </span>

                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => openEditModal(user)}
                    className="p-2 text-gray-500 hover:text-[#b42a28] hover:bg-[#b42a28]/10 rounded-full transition-colors"
                    title="Modifica"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    disabled={resetting === user.id}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors disabled:opacity-50"
                    title="Reset Password"
                  >
                    {resetting === user.id ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    )}
                  </button>
                  {deleteConfirm === user.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={deleting}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? '...' : 'Conferma'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(user.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Elimina"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              {editingUser ? 'Modifica Staff' : 'Nuovo Staff'}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-3 text-black focus:ring-2 focus:ring-[#b42a28] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser ? '(lascia vuoto per non modificare)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-3 text-black focus:ring-2 focus:ring-[#b42a28] focus:border-transparent"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-3 text-black focus:ring-2 focus:ring-[#b42a28] focus:border-transparent"
                >
                  <option value="staff">Staff (solo redemption)</option>
                  <option value="admin">Admin (accesso completo)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.role === 'admin'
                    ? 'Accesso completo alla dashboard e configurazioni'
                    : 'Accesso limitato alla redemption premi'
                  }
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-full border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-full bg-[#b42a28] text-white font-semibold hover:brightness-110 transition-all shadow-lg shadow-[#b42a28]/20 disabled:opacity-50"
                >
                  {saving ? 'Salvataggio...' : (editingUser ? 'Salva' : 'Crea')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Link Reset Password</h3>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Condividi questo link con l&apos;utente. Il link scade tra 24 ore.
            </p>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={resetLink}
                className="w-full border border-gray-300 rounded-xl p-3 pr-24 text-sm text-gray-700 bg-gray-50"
              />
              <button
                onClick={copyToClipboard}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  copySuccess
                    ? 'bg-green-100 text-green-700'
                    : 'bg-[#b42a28] text-white hover:brightness-110'
                }`}
              >
                {copySuccess ? 'Copiato!' : 'Copia'}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-6 py-2.5 rounded-full bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
