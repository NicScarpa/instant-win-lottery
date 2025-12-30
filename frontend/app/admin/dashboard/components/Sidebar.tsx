'use client';

import { useState } from 'react';

interface SidebarProps {
    currentView: string;
    onChangeView: (view: string) => void;
    onLogout: () => void;
    // Nuove props per le impostazioni promozione
    onRefreshData?: () => void;
    onEditPromotion?: () => void;
    onDeletePromotion?: () => void;
    canDelete?: boolean;
}

export default function Sidebar({
    currentView,
    onChangeView,
    onLogout,
    onRefreshData,
    onEditPromotion,
    onDeletePromotion,
    canDelete = true,
}: SidebarProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'token', label: 'Token', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
        { id: 'premi', label: 'Premi', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
        { id: 'log', label: 'Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
        { id: 'staff', label: 'Staff', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { id: 'audit', label: 'Attivita', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        { id: 'branding', label: 'Branding', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
        { id: 'engine', label: 'Engine', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
        { id: 'leaderboard', label: 'Classifica', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ];

    // Contenuto condiviso della sidebar (navigation + settings)
    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <>
            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            onChangeView(item.id);
                            if (isMobile) setIsMobileOpen(false);
                        }}
                        className={`
                            w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group
                            ${currentView === item.id
                                ? 'bg-[#b42a28] text-white shadow-lg shadow-[#b42a28]/30'
                                : 'text-gray-400 hover:bg-white/10 hover:text-white'
                            }
                        `}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                        <span className="font-medium">{item.label}</span>
                    </button>
                ))}

                {/* Sezione Impostazioni Promozione - Collapsible */}
                <div className="pt-4 mt-4 border-t border-white/10">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-gray-400 hover:text-white transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium">Impostazioni</span>
                        </div>
                        <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Settings submenu */}
                    {isSettingsOpen && (
                        <div className="mt-2 ml-4 space-y-1 animate-fade-in">
                            <button
                                onClick={() => {
                                    onRefreshData?.();
                                    if (isMobile) setIsMobileOpen(false);
                                }}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="text-sm">Aggiorna Dati</span>
                            </button>

                            <button
                                onClick={() => {
                                    onEditPromotion?.();
                                    if (isMobile) setIsMobileOpen(false);
                                }}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span className="text-sm">Modifica Promo</span>
                            </button>

                            <button
                                onClick={() => {
                                    onDeletePromotion?.();
                                    if (isMobile) setIsMobileOpen(false);
                                }}
                                disabled={!canDelete}
                                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                                    canDelete
                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                        : 'text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="text-sm">Elimina Promo</span>
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/10">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar - Fixed on the left */}
            <div className="hidden md:flex fixed inset-y-0 left-0 w-72 bg-[#2d2d2d] text-white flex-col z-40">
                {/* Desktop Header */}
                <div className="flex items-center justify-center px-4 py-6 border-b border-white/10">
                    <div className="px-4 py-2 border border-white/30 rounded-full text-lg font-medium">
                        Campari
                    </div>
                </div>
                <SidebarContent isMobile={false} />
            </div>

            {/* Mobile Header / Toggle - Only visible on mobile */}
            <div className="md:hidden flex justify-between items-center bg-[#2d2d2d] px-4 py-3 text-white fixed top-0 left-0 right-0 z-50 shadow-md h-14">
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 border border-white/30 rounded-full text-sm font-medium">
                        Campari
                    </div>
                </div>
                <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2">
                    {isMobileOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                </button>
            </div>

            {/* Mobile Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
                md:hidden transition duration-200 ease-in-out
                w-72 bg-[#2d2d2d] text-white flex flex-col z-40 h-screen overflow-y-auto pt-16
            `}>
                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onChangeView(item.id);
                                setIsMobileOpen(false);
                            }}
                            className={`
                                w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group
                                ${currentView === item.id
                                    ? 'bg-[#b42a28] text-white shadow-lg shadow-[#b42a28]/30'
                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                }
                            `}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}

                    {/* Sezione Impostazioni Promozione - Collapsible */}
                    <div className="pt-4 mt-4 border-t border-white/10">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="w-full flex items-center justify-between px-4 py-3.5 text-gray-400 hover:text-white transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="font-medium">Impostazioni</span>
                            </div>
                            <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* Settings submenu */}
                        {isSettingsOpen && (
                            <div className="mt-2 ml-4 space-y-1 animate-fade-in">
                                <button
                                    onClick={() => {
                                        onRefreshData?.();
                                        setIsMobileOpen(false);
                                    }}
                                    className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span className="text-sm">Aggiorna Dati</span>
                                </button>

                                <button
                                    onClick={() => {
                                        onEditPromotion?.();
                                        setIsMobileOpen(false);
                                    }}
                                    className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className="text-sm">Modifica Promo</span>
                                </button>

                                <button
                                    onClick={() => {
                                        onDeletePromotion?.();
                                        setIsMobileOpen(false);
                                    }}
                                    disabled={!canDelete}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                                        canDelete
                                            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                            : 'text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span className="text-sm">Elimina Promo</span>
                                </button>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-3 px-4 py-3.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </>
    );
}
