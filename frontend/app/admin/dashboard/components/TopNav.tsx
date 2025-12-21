'use client';

import React from 'react';
import { LogOut } from 'lucide-react';

interface TopNavProps {
    currentView: string;
    onChangeView: (view: string) => void;
    onLogout: () => void;
    userName?: string;
}

const NAVIGATION_ITEMS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'token', label: 'Token' },
    { id: 'premi', label: 'Premi' },
    { id: 'log', label: 'Log' },
];

export default function TopNav({ currentView, onChangeView, onLogout, userName = 'Admin' }: TopNavProps) {
    return (
        <div className="hidden md:flex items-center justify-between px-10 py-6 relative z-20">
            {/* Brand Logo */}
            <div className="flex items-center justify-center px-6 py-3 border-[1.5px] border-gray-900 rounded-full font-medium text-xl tracking-tight bg-white/40 backdrop-blur-sm cursor-pointer hover:bg-white/80 transition-all">
                Campari
            </div>

            {/* Main Navigation - Centered Pill */}
            <nav className="flex items-center bg-white/70 backdrop-blur-xl rounded-full p-1.5 border border-white/40 shadow-sm">
                {NAVIGATION_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onChangeView(item.id)}
                        className={`px-6 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 ${
                            currentView === item.id
                                ? 'bg-[#2d2d2d] text-white shadow-lg scale-105'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Action Icons - Right side */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-5 py-3 bg-white/70 backdrop-blur-md rounded-full border border-white/50 text-gray-700 hover:bg-white hover:text-[#b42a28] transition-all hover:shadow-md"
                >
                    <LogOut size={18} />
                    <span className="text-[13px] font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
}
