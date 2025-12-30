'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '../../lib/api';

export default function SuperAdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('superadmin_token');
        if (!token) {
          setLoading(false);
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(getApiUrl('api/superadmin/tenants'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          router.replace('/superadmin/dashboard');
        } else {
          localStorage.removeItem('superadmin_token');
          setLoading(false);
        }
      } catch (err) {
        console.error("Session check error:", err);
        localStorage.removeItem('superadmin_token');
        setLoading(false);
      }
    };

    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(getApiUrl('api/superadmin/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.token) {
          localStorage.setItem('superadmin_token', data.token);
        }
        router.replace('/superadmin/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Verifying session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-white mb-2">Super Admin</div>
          <div className="text-gray-400 text-sm">Instant Win Platform</div>
        </div>

        {error && (
          <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm border border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="superadmin"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition font-medium"
          >
            Login
          </button>
        </form>

        <div className="mt-6 text-center text-gray-500 text-xs">
          Access restricted to platform administrators
        </div>
      </div>
    </div>
  );
}
