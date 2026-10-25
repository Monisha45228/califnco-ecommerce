import React, { useMemo, useState } from 'react';
import { Search, Save, ShieldAlert, UserRound } from 'lucide-react';
import { UserProfile } from '../types';
import { adminStore } from '../services/store';

interface UsersTabProps {
  users: UserProfile[];
}

export const UsersTab: React.FC<UsersTabProps> = ({ users }) => {
  const [term, setTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'dealer'>('all');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, {
    name: string;
    phone: string;
    role: 'customer' | 'dealer';
    address: NonNullable<UserProfile['address']>;
  }>>({});
  const filtered = useMemo(() => users.filter(user =>
    (roleFilter === 'all' || user.role === roleFilter) &&
    `${user.name} ${user.email} ${user.phone}`.toLowerCase().includes(term.toLowerCase())
  ), [users, roleFilter, term]);

  const draftFor = (user: UserProfile) => drafts[user.uid] || {
    name: user.name,
    phone: user.phone,
    role: user.role === 'dealer' ? 'dealer' as const : 'customer' as const,
    address: { street: '', city: '', state: '', postalCode: '', ...user.address }
  };

  const saveUser = async (user: UserProfile) => {
    const draft = draftFor(user);
    if (!draft.name.trim()) {
      setError('A user name is required.');
      return;
    }
    const phone = draft.phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a phone number with exactly 10 digits.');
      return;
    }
    setSaving(user.uid);
    setError('');
    try {
      await adminStore.updateUser(user.uid, { ...draft, name: draft.name.trim(), phone });
      setDrafts(current => {
        const next = { ...current };
        delete next[user.uid];
        return next;
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update user.');
    } finally {
      setSaving(null);
    }
  };

  const toggleBlocked = async (user: UserProfile) => {
    setSaving(user.uid);
    setError('');
    try {
      await adminStore.updateUser(user.uid, { blocked: !user.blocked });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not change user access.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">Customer & Dealer Accounts</h2>
        <p className="text-xs text-slate-500">Live Firestore users. Changes are reflected in the app immediately.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input aria-label="Search users" value={term} onChange={event => setTerm(event.target.value)} placeholder="Search name, email, phone" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
        </div>
        <select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">All accounts</option><option value="customer">Customers</option><option value="dealer">Dealers</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">User</th><th className="p-3">Name / phone</th><th className="p-3">Address</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(user => {
              const draft = draftFor(user);
              return <tr key={user.uid}>
                <td className="p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" /><span><span className="block font-semibold">{user.email}</span><span className="block max-w-[180px] truncate text-[10px] text-slate-400">{user.uid}</span></span></div></td>
                <td className="p-3"><input aria-label={`${user.email} name`} value={draft.name} onChange={event => setDrafts(current => ({ ...current, [user.uid]: { ...draft, name: event.target.value } }))} className="mb-1 w-44 rounded border border-slate-200 px-2 py-1" /><input aria-label={`${user.email} phone`} type="tel" inputMode="numeric" maxLength={10} value={draft.phone} onChange={event => setDrafts(current => ({ ...current, [user.uid]: { ...draft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) } }))} className="block w-44 rounded border border-slate-200 px-2 py-1" /></td>
                <td className="p-3"><div className="grid grid-cols-2 gap-1">{(['street', 'city', 'state', 'postalCode'] as const).map(field => <input key={field} aria-label={`${user.email} ${field}`} placeholder={field} value={draft.address[field] || ''} onChange={event => setDrafts(current => ({ ...current, [user.uid]: { ...draft, address: { ...draft.address, [field]: event.target.value } } }))} className="w-28 rounded border border-slate-200 px-2 py-1" />)}</div></td>
                <td className="p-3"><select aria-label={`${user.email} role`} value={draft.role} onChange={event => setDrafts(current => ({ ...current, [user.uid]: { ...draft, role: event.target.value as 'customer' | 'dealer' } }))} className="rounded border border-slate-200 px-2 py-1"><option value="customer">Customer</option><option value="dealer">Dealer</option></select></td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.blocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{user.blocked ? 'Blocked' : 'Active'}</span></td>
                <td className="p-3"><div className="flex gap-2"><button disabled={saving === user.uid} onClick={() => void saveUser(user)} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Save className="h-3 w-3" />Save</button><button disabled={saving === user.uid} onClick={() => void toggleBlocked(user)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${user.blocked ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}><ShieldAlert className="h-3 w-3" />{user.blocked ? 'Unblock' : 'Block'}</button></div></td>
              </tr>;
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No users found in Firestore.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
