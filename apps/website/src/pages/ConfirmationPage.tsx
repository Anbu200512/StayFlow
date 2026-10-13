import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Mail, Phone, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { ErrorState, PageIntro } from '../components/States';
import type { Reservation } from '../types';

export default function ConfirmationPage() {
  const { bookingNumber = '' } = useParams();
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = 'Booking confirmation · Alder House'; }, []);
  const lookup = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { setReservation(await publicApi.lookupBooking({ bookingNumber, emailOrMobile })); } catch (requestError) { setError((requestError as { userMessage?: string }).userMessage ?? 'We could not find that booking.'); } finally { setLoading(false); }
  };
  if (!bookingNumber) return <ErrorState message="No booking reference was provided." />;
  return <><PageIntro eyebrow="Booking confirmation" title="We have your stay." description="Keep your booking reference handy. Our team will be ready to welcome you." /><div className="mx-auto max-w-3xl px-5 pb-24 lg:px-10">{reservation ? <ReservationCard reservation={reservation} /> : <div className="border border-ink/10 bg-white p-6 md:p-10"><div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest"><Search size={20} /></span><div><h2 className="font-display text-3xl">View your reservation</h2><p className="mt-2 text-sm text-ink/55">Enter the email address or mobile number used for booking <strong className="text-ink">{bookingNumber}</strong>.</p></div></div><form onSubmit={lookup} className="mt-7"><label className="label-text">Email or mobile</label><input className="input-field max-w-md" value={emailOrMobile} onChange={(event) => setEmailOrMobile(event.target.value)} required placeholder="you@example.com" />{error && <p className="mt-3 text-sm text-copper">{error}</p>}<button type="submit" className="button-primary mt-5" disabled={loading}>{loading ? 'Looking up…' : 'View reservation'}</button></form></div>}<div className="mt-8 flex flex-wrap gap-4 text-sm"><Link to="/rooms" className="button-secondary">Book another stay</Link><Link to="/" className="inline-flex items-center px-2 text-forest">Back to home</Link></div></div></>;
}

function ReservationCard({ reservation }: { reservation: Reservation }) { return <div className="border border-forest/20 bg-white p-6 shadow-soft md:p-10"><div className="flex items-center gap-3 text-forest"><CheckCircle2 size={23} /><p className="text-sm font-semibold uppercase tracking-[0.14em]">{reservation.status === 'confirmed' ? 'Reservation confirmed' : `Status: ${reservation.status}`}</p></div><p className="mt-6 text-xs uppercase tracking-[0.16em] text-ink/45">Booking reference</p><p className="mt-1 font-display text-4xl text-ink">{reservation.bookingNumber}</p><div className="mt-8 grid gap-5 border-y border-ink/10 py-6 sm:grid-cols-2"><Info label="Guest" value={reservation.guestSnapshot.fullName} /><Info label="Room" value={reservation.roomTypeId?.name ?? 'Reserved room'} /><Info label="Check in" value={new Date(reservation.checkIn).toLocaleDateString('en-IN', { dateStyle: 'medium' })} /><Info label="Check out" value={new Date(reservation.checkOut).toLocaleDateString('en-IN', { dateStyle: 'medium' })} /></div><div className="mt-6"><p className="eyebrow">Your total</p><p className="mt-2 font-display text-4xl text-forest">₹{reservation.pricing.total.toLocaleString('en-IN')}</p></div><div className="mt-8 flex flex-wrap gap-3"><a href={`mailto:hello@alderhouse.example?subject=${encodeURIComponent(`StayFlow booking ${reservation.bookingNumber}`)}`} className="button-secondary"><Mail size={15} />Email details</a><a href="tel:+919876543210" className="button-secondary"><Phone size={15} />Call the house</a><button type="button" onClick={() => window.print()} className="button-secondary"><Download size={15} />Print</button></div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">{label}</p><p className="mt-1 text-sm text-ink">{value}</p></div>; }
