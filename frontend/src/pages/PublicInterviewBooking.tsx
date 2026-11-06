import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, CheckCircle2, AlertCircle, Video, Phone, Laptop, Building, 
  User, Check, Loader2, Download, ArrowRight, Sparkles, MapPin, Globe, ShieldCheck
} from 'lucide-react';
import { api, getApiUrl } from '../lib/api';
import { Button } from '@/components/ui/button';

interface Slot {
  iso: string;
  time: string;
}

interface DayGroup {
  date: string;
  day_name: string;
  display_date: string;
  slots: Slot[];
}

interface InvitationDetails {
  token: string;
  application_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  department: string;
  company_name: string;
  duration_min: number;
  interview_type: 'video' | 'phone' | 'technical' | 'in_person';
  interviewers: string[];
  status: 'pending' | 'booked' | 'expired' | 'cancelled';
  expires_at: string;
  booked_schedule?: {
    scheduled_at: string;
    meeting_link: string;
    interview_type: string;
    status: string;
    ics_url?: string;
    google_calendar_url?: string;
  };
  available_slots: DayGroup[];
}

export const PublicInterviewBooking: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  // Booking selection state
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [candidateNotes, setCandidateNotes] = useState<string>('');
  const [bookingPending, setBookingPending] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing interview booking token.');
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/hiring/invitations/${token}/`);
        setInvitation(data);
        if (data.status === 'booked' && data.booked_schedule) {
          setBookingSuccess({
            schedule: data.booked_schedule,
            google_calendar_url: data.booked_schedule.google_calendar_url,
            ics_url: data.booked_schedule.ics_url,
            meeting_link: data.booked_schedule.meeting_link,
          });
        }
      } catch (err: any) {
        setError(err?.data?.error || err?.message || 'Interview invitation link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [token]);

  const handleConfirmBooking = async () => {
    if (!token || !selectedSlot) return;

    setBookingPending(true);
    try {
      const resp = await api.post(`/hiring/invitations/${token}/book/`, {
        scheduled_at: selectedSlot.iso,
        candidate_notes: candidateNotes.trim()
      });
      setBookingSuccess(resp);
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'Failed to confirm interview booking. Please select another slot.');
    } finally {
      setBookingPending(false);
    }
  };

  const getInterviewTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4 text-primary" />;
      case 'phone': return <Phone className="h-4 w-4 text-emerald-500" />;
      case 'technical': return <Laptop className="h-4 w-4 text-violet-500" />;
      default: return <Building className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading interview schedule...</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-100">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Invitation Unavailable</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {error || 'This interview invitation is either invalid, already booked, or has reached its expiration date.'}
          </p>
          <div className="pt-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')} 
              className="text-xs font-bold rounded-xl px-5"
            >
              Return to Homepage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Already booked screen
  if (bookingSuccess) {
    const scheduledDate = new Date(bookingSuccess.schedule?.scheduled_at || bookingSuccess.scheduled_at || '');
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-800 dark:text-slate-100 font-sans">
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              Interview Confirmed
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              You are all set, {invitation.candidate_name}!
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A calendar invitation and confirmation email have been sent to <span className="font-semibold text-slate-800 dark:text-slate-200">{invitation.candidate_email}</span>.
            </p>
          </div>

          {/* Meeting Details Card */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{invitation.job_title}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{invitation.company_name}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</span>
              <span className="text-xs font-black text-primary">
                {!isNaN(scheduledDate.getTime()) ? scheduledDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Confirmed'}
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{invitation.duration_min} Minutes</span>
            </div>

            {invitation.interviewers && invitation.interviewers.length > 0 && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interviewer(s)</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{invitation.interviewers.join(', ')}</span>
              </div>
            )}

            {bookingSuccess.meeting_link && (
              <div className="pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Meeting Room Link</span>
                <a 
                  href={bookingSuccess.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                >
                  <Video className="h-4 w-4" />
                  <span>Join CORE Virtual Meeting Room</span>
                </a>
              </div>
            )}
          </div>

          {/* Calendar Sync Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            {bookingSuccess.google_calendar_url && (
              <a
                href={bookingSuccess.google_calendar_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs text-center"
              >
                <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">Google Calendar</span>
              </a>
            )}
            {bookingSuccess.ics_url && (
              <a
                href={bookingSuccess.ics_url}
                download="interview-invite.ics"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs text-center"
              >
                <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="truncate">Download .ics</span>
              </a>
            )}
          </div>

          <div className="pt-2 text-center">
            <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Secured by CORE Enterprise ATS & Virtual Rooms
            </span>
          </div>
        </div>
      </div>
    );
  }

  const selectedDay = invitation.available_slots[selectedDayIndex] || invitation.available_slots[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Info Panel */}
        <div className="md:col-span-5 bg-slate-50 dark:bg-slate-950/60 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary text-white font-black text-xs flex items-center justify-center shadow-xs">
                {invitation.company_name.charAt(0).toUpperCase()}
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {invitation.company_name}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Interview Self-Scheduling</span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {invitation.job_title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hi <span className="font-semibold text-slate-800 dark:text-slate-200">{invitation.candidate_name}</span>, please select an available time that works best for your interview.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-semibold">{invitation.duration_min} minutes</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                {getInterviewTypeIcon(invitation.interview_type)}
                <span className="font-semibold capitalize">{invitation.interview_type.replace('_', ' ')} Interview</span>
              </div>
              {invitation.interviewers && invitation.interviewers.length > 0 && (
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>With: <strong className="text-slate-800 dark:text-slate-200">{invitation.interviewers.join(', ')}</strong></span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-[11px] text-slate-400 space-y-1">
            <p>🔒 Instant confirmation & calendar sync (.ics / Google Calendar).</p>
            <p>Times are displayed in your local browser timezone.</p>
          </div>
        </div>

        {/* Right Slots & Confirmation Panel */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                Select a Date & Time
              </h2>
              <p className="text-xs text-slate-500">Pick from our available interviewer slots over the coming days:</p>
            </div>

            {/* Day Selector Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {invitation.available_slots.map((day, idx) => {
                const isSelected = selectedDayIndex === idx;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => {
                      setSelectedDayIndex(idx);
                      setSelectedSlot(null);
                    }}
                    className={`flex flex-col items-center justify-center min-w-[76px] py-2.5 px-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-102'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary/40'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary-foreground/90' : 'text-slate-400'}`}>
                      {day.day_name.slice(0, 3)}
                    </span>
                    <span className="text-sm font-black mt-0.5">
                      {new Date(day.date).getDate()}
                    </span>
                    <span className={`text-[9px] font-medium ${isSelected ? 'text-primary-foreground/80' : 'text-slate-400'}`}>
                      {day.slots.length} slots
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Time Slot Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Available Times for {selectedDay?.display_date || 'Selected Date'}
              </span>

              {selectedDay && selectedDay.slots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {selectedDay.slots.map((slot) => {
                    const isPicked = selectedSlot?.iso === slot.iso;
                    return (
                      <button
                        key={slot.iso}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isPicked
                            ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-primary/30'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-primary/5 hover:border-primary/30'
                        }`}
                      >
                        <Clock className={`h-3 w-3 ${isPicked ? 'text-white' : 'text-slate-400'}`} />
                        <span>{slot.time}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  No slots available on this day. Please check the other dates.
                </div>
              )}
            </div>

            {/* Optional Candidate Note */}
            {selectedSlot && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Notes for the Interviewer (Optional)
                </label>
                <textarea
                  value={candidateNotes}
                  onChange={(e) => setCandidateNotes(e.target.value)}
                  placeholder="Share any special topics, availability notes, or preferred contact details..."
                  rows={2}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs bg-slate-50/50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Confirm Button Footer */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs">
              {selectedSlot ? (
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Selected: <span className="text-primary">{selectedDay?.display_date} at {selectedSlot.time}</span>
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Please pick a time slot above</span>
              )}
            </div>

            <Button
              type="button"
              disabled={!selectedSlot || bookingPending}
              onClick={handleConfirmBooking}
              className="text-xs font-bold h-10 px-5 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md gap-1.5"
            >
              {bookingPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <span>Confirm Booking</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
