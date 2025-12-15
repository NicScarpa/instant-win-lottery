import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#E3001B] text-white p-6 text-center font-sans">
      <div className="max-w-md w-full">
        {/* Titolo / Logo Placeholder */}
        <h1 className="text-5xl font-black mb-2 tracking-tighter uppercase">Campari<br/>Soda</h1>
        <p className="text-xl mb-12 font-medium tracking-widest uppercase">Instant Win</p>
        
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl border border-white/20 shadow-2xl">
          <p className="mb-8 text-lg leading-relaxed">
            Hai ricevuto un codice di gioco?
            <br />
            <strong>Scansiona il QR Code</strong> sul tuo talloncino per scoprire subito se hai vinto!
          </p>
          
          <div className="h-1 w-20 bg-white mx-auto mb-8 opacity-50 rounded-full"></div>

          <p className="text-sm mb-4 opacity-90">Sei un membro dello staff?</p>
          
          <Link 
            href="/admin/login" 
            className="inline-block w-full bg-white text-[#E3001B] px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-gray-100 hover:scale-105 transition-all uppercase tracking-widest"
          >
            Accedi allo Staff
          </Link>
        </div>

        <footer className="mt-12 text-xs opacity-60 font-mono">
          © 2025 Campari Soda Event
        </footer>
      </div>
    </div>
  );
}