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
        // MODIFICA: Uso getApiUrl
        const res = await fetch(getApiUrl('api/auth/me'), {
          method: 'GET',
          credentials: 'include' 
        });

        if (res.ok) {
          const data = await res.json();
          // Se la sessione è valida, reindirizza IMMEDIATAMENTE alla dashboard.
          if (data.user.role === 'admin') {
            router.replace('/admin/dashboard'); 
          } else {
            router.replace('/staff'); // Presumo che la dashboard staff sia su /staff
          }
        } else {
          // Se 401/403/errore, mostra il form.
          setLoading(false); 
        }
      } catch (err) {
        // Errore di connessione (server spento o errore di rete)
        console.error("Errore di connessione alla API:", err);
        setLoading(false); 
        // Potresti voler mostrare un messaggio di errore di connessione qui, ma per ora lo lasciamo silenzioso.
      }
    };
    
    checkSession();
  }, [router]);
  // -------------------------------------------------------------------


  const handleLogin = async (e: any) => {
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
        // Login riuscito! Reindirizza solo dopo l'impostazione del cookie
        if (data.role === 'admin') { // Ho corretto da data.user.role a data.role in base al server.ts
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
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 transition"
          >
            Entra
          </button>
        </form>
      </div>
    </div>
  );
}