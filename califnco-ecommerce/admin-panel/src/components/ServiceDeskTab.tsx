import React, { useState } from 'react';
import { 
  Wrench, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { ServiceBooking, ServiceStatus } from '../types';
import { adminStore } from '../services/store';

interface ServiceDeskTabProps {
  services: ServiceBooking[];
}

export const ServiceDeskTab: React.FC<ServiceDeskTabProps> = ({ services }) => {
  const [filter, setFilter] = useState<string>('all');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [techName, setTechName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredServices = services.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const handleAssignTechnician = async () => {
    if (!assigningId || !techName.trim() || !techPhone.trim()) {
      setActionError('Enter the assigned technician name and phone number.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await adminStore.assignTechnician(assigningId, techName.trim(), techPhone.trim());
      setAssigningId(null);
      setTechName('');
      setTechPhone('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to assign a technician.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (serviceId: string, status: ServiceStatus) => {
    setActionError('');
    try {
      await adminStore.updateServiceStatus(serviceId, status);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update service status.');
    }
  };

  const getServiceTypeBadge = (type: string) => {
    switch (type) {
      case 'installation':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">New Installation</span>;
      case 'filter_replacement':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">Filter Change</span>;
      case 'annual_maintenance_amc':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">Annual AMC</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">Breakdown Repair</span>;
    }
  };

  return (
    <div className="space-y-6">
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>}
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Califnco Service & Maintenance Desk</h2>
          <p className="text-xs text-slate-500">
            Dispatch certified RO engineers for doorstep installation, filter maintenance, and breakdown AMC.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
          {['all', 'requested', 'assigned', 'in_progress', 'completed'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                filter === st ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Services List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredServices.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-slate-400 bg-white rounded-2xl border">
            No service requests found for this filter.
          </div>
        ) : (
          filteredServices.map(service => (
            <div 
              key={service.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-400">{service.id}</span>
                    <h3 className="font-bold text-slate-900 text-sm mt-0.5">{service.customerName}</h3>
                  </div>
                  {getServiceTypeBadge(service.serviceType)}
                </div>

                {/* Model & Notes */}
                {service.purifierModel && (
                  <p className="text-xs font-medium text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">
                    Appliance: {service.purifierModel}
                  </p>
                )}

                {service.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{service.notes}"
                  </p>
                )}

                {/* Schedule & Location */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{service.preferredDate} · {service.preferredTimeSlot}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{service.customerPhone}</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{service.address.street}, {service.address.city}</span>
                  </div>
                </div>

                {/* Assigned Tech Info */}
                {service.assignedTechnician ? (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-xs">
                    <div className="flex items-center justify-between text-emerald-800 font-semibold mb-0.5">
                      <span className="flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assigned Technician</span>
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{service.assignedTechnician.name}</p>
                    <p className="text-slate-500 text-[11px]">{service.assignedTechnician.phone}</p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 flex items-center justify-between">
                    <span>No technician dispatched yet</span>
                    <button
                      onClick={() => setAssigningId(service.id)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px]"
                    >
                      Assign
                    </button>
                  </div>
                )}
              </div>

              {/* Status Update Dropdown */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  {service.charge === 0 ? 'FREE AMC' : `₹${service.charge}`}
                </span>

                <select
                  value={service.status}
                  onChange={e => void handleStatusChange(service.id, e.target.value as ServiceStatus)}
                  className={`text-xs font-semibold rounded-lg px-2 py-1 border transition-all cursor-pointer ${
                    service.status === 'completed' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                    service.status === 'in_progress' ? 'bg-sky-50 border-sky-300 text-sky-800' :
                    service.status === 'assigned' ? 'bg-indigo-50 border-indigo-300 text-indigo-800' :
                    'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                >
                  <option value="requested">Requested</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Technician Assignment Modal */}
      {assigningId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-900 text-base">Assign Certified Field Engineer</h3>
            <p className="text-xs text-slate-500">
              The assigned engineer will receive an automated dispatch SMS and customer address.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Engineer Name</label>
                <input
                  type="text"
                  value={techName}
                  onChange={e => setTechName(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Engineer Mobile</label>
                <input
                  type="text"
                  value={techPhone}
                  onChange={e => setTechPhone(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setAssigningId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTechnician}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
