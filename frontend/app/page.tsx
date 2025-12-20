import Link from 'next/link';

export default function Home() {
  const bgStyle = {
    backgroundColor: '#E3001B',
    backgroundImage: `url('/bottiglia.png')`,
    backgroundSize: '80px',
    backgroundRepeat: 'repeat',
    backgroundBlendMode: 'soft-light' as const,
  };

  return (
    <div style={bgStyle} className="min-h-screen flex flex-col items-center justify-center text-white p-6 text-center font-sans">
      <div className="max-w-md w-full flex flex-col items-center">
        {/* Logo */}
        <header className="mb-8">
          <img
            src="/camparisoda.png"
            alt="Campari Soda"
            className="w-48 mx-auto drop-shadow-md"
          />
        </header>

        <div className="bg-white text-black p-8 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full">
          <p className="mb-0 text-xl leading-relaxed font-bold uppercase tracking-tight">
            Scansiona il codice QR e scopri se hai vinto
          </p>
        </div>

        <footer className="mt-12">
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