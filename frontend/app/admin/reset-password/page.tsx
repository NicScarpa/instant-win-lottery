'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '../../lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [username, setUsername] = useState('');
  const [tokenValid, setTokenValid] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Token mancante. Richiedi un nuovo link di reset.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(getApiUrl('api/auth/verify-reset-token'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setTokenValid(true);
          setUsername(data.username);
        } else {
          setError(data.error || 'Token non valido o scaduto');
        }
      } catch (err) {
        setError('Errore di connessione al server');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(getApiUrl('api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/admin/login');
        }, 3000);
      } else {
        setError(data.error || 'Errore durante il reset della password');
      }
    } catch (err) {
      setError('Errore di connessione al server');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-sm text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifica token in corso...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Link Non Valido
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/admin/forgot-password"
              className="block w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 transition text-center"
            >
              Richiedi Nuovo Link
            </Link>
            <Link
              href="/admin/login"
              className="block mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Torna al Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Password Aggiornata!
            </h1>
            <p className="text-gray-600 mb-4">
              La tua password è stata reimpostata con successo.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Verrai reindirizzato al login...
            </p>
            <Link
              href="/admin/login"
              className="block w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 transition text-center"
            >
              Vai al Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">
          Reimposta Password
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Crea una nuova password per <strong>{username}</strong>
        </p>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nuova Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={submitting}
            />
            <p className="text-xs text-gray-400 mt-1">Minimo 8 caratteri</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Conferma Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
              autoComplete="new-password"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Aggiornamento...' : 'Aggiorna Password'}
          </button>

          <Link
            href="/admin/login"
            className="block text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Torna al Login
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
