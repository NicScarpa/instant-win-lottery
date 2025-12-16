import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#E3001B] text-white p-6 text-center font-sans">
      <div className="max-w-md w-full flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 w-48">
          <img src="/logo.png" alt="Campari Soda" className="w-full h-auto drop-shadow-lg" />
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl border border-white/20 shadow-2xl w-full">
          <p className="mb-0 text-lg leading-relaxed font-bold">
            Scansiona il codice QR e scopri se hai vinto
          </p>
        </div>

        <footer className="mt-12 flex flex-col items-center gap-4">
          <p className="text-xs opacity-60 font-mono">
            © 2025 Campari Soda Event
          </p>
          
          <Link 
            href="/admin/login" 
            className="text-white/40 text-xs hover:text-white hover:underline transition-colors uppercase tracking-widest"
          >
            Area Riservata
          </Link>
        </footer>
      </div>
    </div>
  );
}