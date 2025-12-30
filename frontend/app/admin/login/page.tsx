'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '../../lib/api'; // <--- MODIFICA: Import getApiUrl

// NOTA BENE: "export default" è obbligatorio qui!
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // Stato di caricamento iniziale
  const router = useRouter();

  // -------------------------------------------------------------------
  // CONTROLLO SESSIONE INVERSO
  // -------------------------------------------------------------------
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if token exists in localStorage
        const token = localStorage.getItem('admin_token');
        if (!token) {
          setLoading(false);
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(getApiUrl('api/auth/me'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          // Se la sessione è valida, reindirizza IMMEDIATAMENTE alla dashboard.
          if (data.user.role === 'admin') {
            router.replace('/admin/dashboard');
          } else {
            router.replace('/staff');
          }
        } else {
          // Token non valido, rimuovilo e mostra il form
          localStorage.removeItem('admin_token');
          setLoading(false);
        }
      } catch (err) {
        console.error("Errore di connessione alla API:", err);
        localStorage.removeItem('admin_token');
        setLoading(false);
      }
    };

    checkSession();
  }, [router]);
  // -------------------------------------------------------------------


  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // RIMOZIONE: Rimosso apiUrl locale, usiamo solo getApiUrl

    try {
      // MODIFICA: Uso getApiUrl
      const res = await fetch(getApiUrl('api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Necessario per inviare e ricevere il cookie JWT
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Login riuscito! Salva il token in localStorage
        if (data.token) {
          localStorage.setItem('admin_token', data.token);
        }

        if (data.role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/staff');
        }
      } else {
        setError(data.error || 'Credenziali non valide');
      }
    } catch (err) {
      setError('Errore di connessione al server');
    }
  };

  // Se è in fase di verifica o se il server è spento, mostra caricamento
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Verifica Sessione in corso...
      </div>
    );
  }

  // Se l'utente non è loggato, mostra il form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Staff Access</h1>

        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 transition"
          >
            Entra
          </button>

          <a
            href="/admin/forgot-password"
            className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-2"
          >
            Password dimenticata?
          </a>
        </form>
      </div>
    </div>
  );
}