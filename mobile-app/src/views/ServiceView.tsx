import React, { useState } from 'react';
import { Wrench, Calendar, Clock, MapPin, UserCheck, ShieldCheck, CheckCircle2, Plus } from 'lucide-react';
import { ServiceBooking, ServiceType, UserProfile } from '../types';

interface ServiceViewProps {
  services: ServiceBooking[];
  user: UserProfile;
  onBookService: (data: {
    serviceType: ServiceType;
    purifierModel: string;
    preferredDate: string;
    preferredTimeSlot: string;
    address: {
      street: string;
      city: string;
      postalCode: string;
    };
    notes: string;
    charge: number;
  }) => Promise<unknown>;
}

export const ServiceView: React.FC<ServiceViewProps> = ({ services, user, onBookService }) => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>('installation');
  const [model, setModel] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState('10:00 AM - 01:00 PM');
  const [notes, setNotes] = useState('');
  const [bookedSuccess, setBookedSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [booking, setBooking] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const serviceOptions: { type: ServiceType; label: string; desc: string; price: number }[] = [
    { type: 'installation', label: 'Doorstep Installation', desc: 'Free with new Califnco purifiers', price: 0 },
    { type: 'filter_replacement', label: 'Filter / Membrane Replacement', desc: 'Includes sediment, carbon & TDS tuning', price: 1499 },
    { type: 'annual_maintenance_amc', label: 'Annual AMC Protection', desc: '3 Free visits + free spare replacements', price: 2499 },
    { type: 'repair_breakdown', label: 'Leakage / Motor Repair', desc: 'Expert troubleshooting within 24h', price: 399 },
    { type: 'water_tds_testing', label: 'Free Water TDS & Purity Test', desc: 'Laboratory testing of your tap water', price: 0 }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    if (!user.address?.street || !user.address.city || !user.address.postalCode) {
      setBookingError('Add a complete delivery address in your profile before booking a service.');
      return;
    }
    const selectedOption = serviceOptions.find(o => o.type === serviceType);
    setBooking(true);
    try {
      await onBookService({
        serviceType,
        purifierModel: model,
        preferredDate: date,
        preferredTimeSlot: slot,
        address: {
          street: user.address.street,
          city: user.address.city,
          postalCode: user.address.postalCode
        },
        notes,
        charge: selectedOption?.price || 0
      });
      setBookedSuccess(true);
      setTimeout(() => {
        setBookedSuccess(false);
        setIsBookingOpen(false);
      }, 1500);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to create the service booking.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Service Desk & AMC</h2>
          <p className="text-xs text-slate-500">Certified doorstep technician assistance & filter AMC</p>
        </div>

        <button
          onClick={() => setIsBookingOpen(true)}
          className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Book Visit</span>
        </button>
      </div>

      {/* Quick Services Overview Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/60 rounded-2xl border border-sky-100 dark:border-slate-700">
          <ShieldCheck className="w-5 h-5 text-sky-600 mb-1" />
          <h4 className="font-bold text-slate-900 dark:text-white text-xs">Genuine Califnco Spares</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">100% original NSF-certified parts with warranty</p>
        </div>

        <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800/60 rounded-2xl border border-indigo-100 dark:border-slate-700">
          <UserCheck className="w-5 h-5 text-indigo-600 mb-1" />
          <h4 className="font-bold text-slate-900 dark:text-white text-xs">Verified Engineers</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Background checked, certified technicians</p>
        </div>
      </div>

      {/* Active Service Bookings List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Service Calls</h3>

        {services.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6 space-y-2">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No pending service calls</p>
            <p className="text-[11px] text-slate-400">
              Need installation, membrane replacement, or TDS check? Tap "Book Visit" above.
            </p>
          </div>
        ) : (
          services.map(booking => (
            <div
              key={booking.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] text-slate-400 font-bold">{booking.id}</span>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs capitalize mt-0.5">
                    {booking.serviceType.replace(/_/g, ' ')}
                  </h4>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  booking.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                  booking.status === 'assigned' ? 'bg-sky-100 text-sky-800' :
                  booking.status === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {booking.status}
                </span>
              </div>

              {booking.purifierModel && (
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 p-2 rounded-xl">
                  Model: {booking.purifierModel}
                </p>
              )}

              <div className="space-y-1 text-[11px] text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Scheduled: {booking.preferredDate} ({booking.preferredTimeSlot})</span>
                </div>
                <div className="flex items-start space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="truncate">{booking.address.street}, {booking.address.city}</span>
                </div>
              </div>

              {booking.assignedTechnician ? (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                      Assigned Field Engineer
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white">{booking.assignedTechnician.name}</p>
                  </div>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    {booking.assignedTechnician.phone}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Dispatch team is assigning your local field engineer.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Booking Drawer / Modal */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Book Doorstep Technician Visit
            </h3>

            {bookedSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-900 dark:text-white text-sm">Service Visit Booked!</p>
                <p className="text-xs text-slate-400">Our operations team has received your ticket.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                {bookingError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">{bookingError}</p>}
                {/* Service Type Selection */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Select Service Required</label>
                  <select
                    value={serviceType}
                    onChange={e => setServiceType(e.target.value as ServiceType)}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {serviceOptions.map(opt => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label} ({opt.price === 0 ? 'FREE' : `₹${opt.price}`})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Purifier Model */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Appliance Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="e.g. Califnco HydroPure Pro 8-Stage"
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Date & Time Slot */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Preferred Date</label>
                    <input
                      type="date"
                      min={today}
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Time Slot</label>
                    <select
                      value={slot}
                      onChange={e => setSlot(e.target.value)}
                      className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option>09:00 AM - 12:00 PM</option>
                      <option>12:00 PM - 03:00 PM</option>
                      <option>03:00 PM - 06:00 PM</option>
                    </select>
                  </div>
                </div>

                {/* Problem Description */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Issue / Remarks</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Filter light blinking or low water flow rate..."
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={booking}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold shadow-sm disabled:opacity-50"
                  >
                    {booking ? 'Booking…' : 'Confirm Service Booking'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
