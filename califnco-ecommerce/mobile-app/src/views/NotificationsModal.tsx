import React, { useState } from 'react';
import { X, Bell, Package, Wrench, Sparkles, Gift } from 'lucide-react';
import { AppNotification } from '../services/store';

interface NotificationsModalProps {
  notifications: AppNotification[];
  onMarkAllRead: () => Promise<void>;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  onMarkAllRead,
  onClose
}) => {
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState('');
  const unreadCount = notifications.filter(item => !item.read).length;

  const markAllRead = async () => {
    setMarkingRead(true);
    setError('');
    try {
      await onMarkAllRead();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to mark notifications as read. Please try again.');
    } finally {
      setMarkingRead(false);
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return <Package className="w-4 h-4 text-sky-600" />;
      case 'service':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'referral':
        return <Gift className="w-4 h-4 text-emerald-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl max-h-[85vh] flex flex-col justify-between border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
              Push Alerts & Notifications
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No notifications yet.</p>
          ) : (
            notifications.map(item => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-start space-x-3 ${
                  item.read
                    ? 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-800 border-sky-200 dark:border-sky-900/60 shadow-sm'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.title}</h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
          {error && <p role="alert" className="mb-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
          <button
            onClick={() => void markAllRead()}
            disabled={markingRead || unreadCount === 0}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline disabled:cursor-default disabled:opacity-50"
          >
            {markingRead ? 'Marking as read…' : unreadCount === 0 ? 'All notifications read' : 'Mark all as read'}
          </button>
        </div>
      </div>
    </div>
  );
};
