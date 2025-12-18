'use client';

import { useState } from 'react';

interface SidebarProps {
    currentView: string;
    onChangeView: (view: string) => void;
    onLogout: () => void;
}

export default function Sidebar({ currentView, onChangeView, onLogout }: SidebarProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'token', label: 'Token', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
        { id: 'premi', label: 'Premi', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
        { id: 'log', label: 'Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    ];

    return (
        <>
            {/* Mobile Header / Toggle */}
            <div className="md:hidden flex justify-between items-center bg-[#1a1a1a] p-4 text-white sticky top-0 z-50 shadow-md">
                <span className="font-bold text-lg">Admin Panel</span>
                <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2">
                    {isMobileOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                </button>
            </div>

            {/* Sidebar Container - Desktop */}
            <div className={`
                hidden md:flex flex-col bg-[#1a1a1a] text-white h-screen overflow-y-auto transition-all duration-300
                ${isCollapsed ? 'w-16' : 'w-64'}
            `}>
                {/* Toggle Button */}
                <div className="p-4 flex justify-end">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title={isCollapsed ? 'Espandi menu' : 'Comprimi menu'}
                    >
                        <svg className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onChangeView(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={`
                                w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-xl transition-all duration-200 group
                                ${currentView === item.id
                                    ? 'bg-[#E3001B] text-white shadow-lg shadow-red-900/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }
                            `}
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            {!isCollapsed && <span className="font-medium">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                {/* Footer Actions */}
                <div className="p-2 border-t border-white/10">
                    <button
                        onClick={onLogout}
                        title={isCollapsed ? 'Logout' : undefined}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors`}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {!isCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
                md:hidden transition duration-200 ease-in-out
                w-64 bg-[#1a1a1a] text-white flex flex-col z-40 h-screen overflow-y-auto pt-16
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
                                w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group
                                ${currentView === item.id
                                    ? 'bg-[#E3001B] text-white shadow-lg shadow-red-900/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }
                            `}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
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
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </>
    );
}
