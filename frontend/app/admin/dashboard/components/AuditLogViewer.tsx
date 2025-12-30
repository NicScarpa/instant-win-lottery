'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../../lib/api';

interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  userId: number | null;
  userType: string;
  username: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogViewerProps {
  refreshKey?: number;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  CREATE_PROMOTION: { label: 'Nuova Promozione', color: 'bg-green-100 text-green-700', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  UPDATE_PROMOTION: { label: 'Modifica Promozione', color: 'bg-blue-100 text-blue-700', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  DELETE_PROMOTION: { label: 'Elimina Promozione', color: 'bg-red-100 text-red-700', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  ACTIVATE_PROMOTION: { label: 'Attiva Promozione', color: 'bg-emerald-100 text-emerald-700', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  GENERATE_TOKENS: { label: 'Genera Token', color: 'bg-purple-100 text-purple-700', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' },
  CREATE_PRIZE: { label: 'Nuovo Premio', color: 'bg-amber-100 text-amber-700', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  REDEEM_PRIZE: { label: 'Premio Riscattato', color: 'bg-teal-100 text-teal-700', icon: 'M5 13l4 4L19 7' },
  CREATE_STAFF: { label: 'Nuovo Staff', color: 'bg-indigo-100 text-indigo-700', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  DELETE_STAFF: { label: 'Elimina Staff', color: 'bg-red-100 text-red-700', icon: 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6' },
  RESET_PASSWORD: { label: 'Reset Password', color: 'bg-orange-100 text-orange-700', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  UPDATE_BRANDING: { label: 'Aggiorna Branding', color: 'bg-pink-100 text-pink-700', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  LOGIN: { label: 'Login', color: 'bg-gray-100 text-gray-700', icon: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' },
};

export default function AuditLogViewer({ refreshKey }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedAction, setSelectedAction] = useState('');
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      let url = `api/admin/audit-logs?limit=${limit}&offset=${offset}`;
      if (selectedAction) url += `&action=${selectedAction}`;

      const res = await fetch(getApiUrl(url), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [offset, selectedAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionInfo = (action: string) => {
    return ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-700', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

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
          <h2 className="text-xl font-bold text-gray-800">Log Attivita</h2>
          <p className="text-sm text-gray-500 mt-1">Cronologia delle azioni eseguite</p>
        </div>
        <select
          value={selectedAction}
          onChange={e => { setSelectedAction(e.target.value); setOffset(0); }}
          className="text-sm border border-gray-200 rounded-full px-4 py-2 bg-white text-gray-800"
        >
          <option value="">Tutte le azioni</option>
          {Object.entries(ACTION_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Logs List */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Nessuna attivita registrata</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const actionInfo = getActionInfo(log.action);
            return (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`p-2 rounded-xl ${actionInfo.color}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={actionInfo.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${actionInfo.color}`}>
                      {actionInfo.label}
                    </span>
                    {log.username && (
                      <span className="text-xs text-gray-500">
                        da <span className="font-medium">{log.username}</span>
                      </span>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {JSON.stringify(log.details)}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{formatDate(log.createdAt)}</span>
                    {log.ipAddress && <span>{log.ipAddress}</span>}
                    <span className="capitalize">{log.entity}</span>
                    {log.entityId && <span>#{log.entityId}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {total} eventi totali
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Precedente
            </button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Successivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
