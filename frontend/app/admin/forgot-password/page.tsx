'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getApiUrl } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [devInfo, setDevInfo] = useState<{ token: string; url: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    setDevInfo(null);

    try {
      const res = await fetch(getApiUrl('api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // In development mode, show the reset link
        if (data.devToken && data.devResetUrl) {
          setDevInfo({ token: data.devToken, url: data.devResetUrl });
        }
      } else {
        setError(data.error || 'Errore durante la richiesta');
      }
    } catch (err) {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">
          Password Dimenticata
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Inserisci il tuo username per ricevere le istruzioni
        </p>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-100 text-green-700 p-4 rounded text-sm">
              <p className="font-medium">Richiesta inviata!</p>
              <p className="mt-1">
                Se l'utente esiste, riceverai un'email con le istruzioni per
                reimpostare la password.
              </p>
            </div>

            {/* Development mode: show reset link */}
            {devInfo && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-sm">
                <p className="font-medium text-yellow-800 mb-2">
                  Modalità Development
                </p>
                <p className="text-yellow-700 text-xs mb-2">
                  SMTP non configurato. Usa questo link per testare:
                </p>
                <Link
                  href={`/admin/reset-password?token=${devInfo.token}`}
                  className="text-blue-600 hover:underline break-all text-xs"
                >
                  {devInfo.url}
                </Link>
              </div>
            )}

            <Link
              href="/admin/login"
              className="block w-full text-center bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200 transition"
            >
              Torna al Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Invio in corso...' : 'Invia Richiesta'}
            </button>

            <Link
              href="/admin/login"
              className="block text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Torna al Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
