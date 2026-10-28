import React, { useState } from 'react';
import { 
  User, 
  Gift, 
  Copy, 
  Check, 
  Moon, 
  Sun, 
  MapPin, 
  MessageCircle, 
  ExternalLink,
  Building2,
  LogOut,
  BellRing
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface ProfileViewProps {
  user: UserProfile;
  role: UserRole;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenMapPicker: () => void;
  onSignOut: () => void;
  onEnablePush: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  role,
  isDarkMode,
  onToggleTheme,
  onOpenMapPicker,
  onSignOut,
  onEnablePush
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (user.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-sky-500/20">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base truncate">
                {user.name}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                role === 'dealer'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
              }`}>
                {role === 'dealer' ? 'Verified Dealer' : 'Customer'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
            <p className="text-xs text-slate-400">{user.phone}</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Active Account Mode</p>
            <p className="text-[10px] text-slate-500">
              {role === 'dealer' ? 'B2B Wholesale with MOQ rules' : 'Retail consumer catalog'}
            </p>
          </div>
          <span className="text-xs font-bold capitalize text-slate-600 dark:text-slate-300">{role}</span>
        </div>
      </div>

      {/* Dealer Business Profile (when in Dealer role) */}
      {role === 'dealer' && user.dealerDetails && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-purple-200 dark:border-purple-900/40 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">
                Business & GSTIN Credentials
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
              Approved
            </span>
          </div>

          <div className="bg-purple-50/50 dark:bg-slate-700/30 rounded-2xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Company Name</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{user.dealerDetails.businessName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Verified GSTIN</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{user.dealerDetails.gstin}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-purple-100 dark:border-slate-700">
              <span className="text-slate-500">Wholesale Credit Line</span>
              <span className="font-extrabold text-purple-700 dark:text-purple-400">
                ₹{user.dealerDetails.creditLimit?.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Customer Referral System (+5 bonus pts) */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800/80 rounded-3xl border border-amber-200/80 dark:border-slate-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">
                Referral Rewards Program (+5 pts)
              </h4>
              <p className="text-[10px] text-slate-500">Share pure health & earn store credits</p>
            </div>
          </div>

          <span className="px-2.5 py-1 bg-amber-500 text-white rounded-xl text-xs font-black shadow-sm">
            ₹{user.walletBalance || 0} Credits
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300">
          Share your referral code with friends. They get <span className="font-bold">₹250 OFF</span> on their first RO purifier order, and you receive <span className="font-bold">₹500</span> in your Califnco wallet!
        </p>

        {/* Copy Referral Code Pill */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 border border-amber-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-400 uppercase font-bold">Your Unique Code</span>
            <p className="font-mono font-extrabold text-slate-900 dark:text-white text-sm tracking-wider">
              {user.referralCode || 'CALIF-PURE99'}
            </p>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preferences & Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-sm space-y-1 text-xs">
        <button onClick={onEnablePush} className="w-full p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center space-x-3 text-sky-700 dark:text-sky-400 font-bold">
          <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center"><BellRing className="w-4 h-4" /></span>
          <span>Enable live order push notifications</span>
        </button>
        {/* Dark Mode Toggle */}
        <div
          onClick={onToggleTheme}
          className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center justify-between cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Dark Mode Theme</p>
              <p className="text-[10px] text-slate-400">Switch between dark and light appearance</p>
            </div>
          </div>
          <span className="font-bold text-sky-600 dark:text-sky-400 capitalize">
            {isDarkMode ? 'Dark' : 'Light'}
          </span>
        </div>

        {/* Change Address */}
        <div
          onClick={onOpenMapPicker}
          className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center justify-between cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Saved Delivery Location</p>
              <p className="text-[10px] text-slate-400">OpenStreetMap GPS interactive pin</p>
            </div>
          </div>
          <span className="font-bold text-sky-600 text-[11px]">Edit &rarr;</span>
        </div>

        {/* WhatsApp Support Desk (+10 bonus WhatsApp integration) */}
        <a
          href="https://wa.me/918754013630?text=Hello%20Califnco%2C%20I%20have%20an%20inquiry%20regarding%20water%20purifier%20products."
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center justify-between transition-colors text-emerald-700 dark:text-emerald-400 font-bold"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Official WhatsApp Support</p>
              <p className="text-[10px] text-slate-400">WAHA Live Chat & Water Expert Desk</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={onSignOut}
          className="w-full p-3 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-3 text-rose-700 dark:text-rose-400 font-bold"
        >
          <span className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </span>
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
};
