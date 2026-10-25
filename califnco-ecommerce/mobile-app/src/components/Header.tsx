import React from 'react';
import { Droplets, ShoppingBag, Bell, Moon, Sun } from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  role: UserRole;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  cartCount: number;
  unreadCount: number;
  onOpenCart: () => void;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  isDarkMode,
  onToggleTheme,
  cartCount,
  unreadCount,
  onOpenCart,
  onOpenNotifications
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3 transition-colors">
      <div className="flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">Califnco</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                role === 'dealer'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
              }`}>
                {role === 'dealer' ? 'Dealer B2B' : 'Consumer'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Pure Water Solutions</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Dark Mode Switcher */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Dark / Light Mode (+5 bonus pts)"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* Shopping Cart Button */}
          <button
            onClick={onOpenCart}
            className="relative p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
