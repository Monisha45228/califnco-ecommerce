import React, { useState } from 'react';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Clock, 
  Search, 
  FileText, 
  Phone, 
  Mail, 
  Building2,
  AlertTriangle
} from 'lucide-react';
import { DealerApplication, adminStore } from '../services/store';

interface DealersTabProps {
  dealers: DealerApplication[];
}

export const DealersTab: React.FC<DealersTabProps> = ({ dealers }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredDealers = dealers.filter(dealer => {
    const matchesFilter = filter === 'all' || dealer.status === filter;
    const matchesSearch = 
      dealer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dealer.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dealer.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dealer.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleApprove = async (id: string) => {
    setActionError('');
    setSavingId(id);
    try {
      await adminStore.updateDealerStatus(id, 'approved', 'Verified GSTIN and business credentials. Approved for wholesale pricing.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to approve this dealer.');
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (rejectingId) {
      const id = rejectingId;
      setActionError('');
      setSavingId(id);
      try {
        await adminStore.updateDealerStatus(id, 'rejected', rejectReason || 'Documentation could not be verified.');
        setRejectingId(null);
        setRejectReason('');
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Unable to reject this dealer.');
      } finally {
        setSavingId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>}
      {/* Overview Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Wholesale Dealer Verification Desk</h2>
          <p className="text-xs text-slate-500">
            Review GSTIN, shop trade licenses, and authorize B2B wholesale pricing accounts.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg capitalize font-medium transition-all ${
                filter === tab ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search business name, GSTIN, city..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      </div>

      {/* Dealers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredDealers.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 bg-white rounded-2xl border">
            No dealer applications found.
          </div>
        ) : (
          filteredDealers.map(dealer => (
            <div 
              key={dealer.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center font-bold text-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{dealer.businessName}</h3>
                    <p className="text-xs text-slate-500">Owner: {dealer.name}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  dealer.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                  dealer.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' :
                  'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {dealer.status}
                </span>
              </div>

              {/* Business Credentials */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">GSTIN Number</span>
                  <span className="font-mono font-bold text-slate-800">{dealer.gstin}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Phone & Email</span>
                  <span className="text-slate-700">{dealer.phone}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Location</span>
                  <span className="text-slate-700">{dealer.city}, {dealer.state}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Wholesale Credit Line</span>
                  <span className="font-bold text-slate-900">₹{dealer.creditLimit.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Notes */}
              {dealer.notes && (
                <p className="text-xs text-slate-600 bg-amber-50/40 p-2.5 rounded-lg border border-amber-100">
                  <span className="font-semibold text-slate-800">Verification Note:</span> {dealer.notes}
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Applied: {new Date(dealer.appliedAt).toLocaleDateString('en-IN')}
                </span>

                <div className="flex space-x-2">
                  {dealer.status !== 'approved' && (
                    <button
                      disabled={savingId === dealer.id}
                      onClick={() => void handleApprove(dealer.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve Dealer</span>
                    </button>
                  )}
                  {dealer.status !== 'rejected' && (
                    <button
                      disabled={savingId === dealer.id}
                      onClick={() => {
                        setRejectingId(dealer.id);
                        setRejectReason('');
                      }}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Reject Dealer Application</h3>
            </div>
            <p className="text-xs text-slate-600">
              Please state the reason for rejection. This notification will be saved in the dealer record and emailed to the applicant.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid GSTIN certificate or unregistered business address..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
