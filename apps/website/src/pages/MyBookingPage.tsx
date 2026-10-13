import { useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { PageIntro } from '../components/States';
import type { Reservation } from '../types';

export default function MyBookingPage() {
  const [bookingNumber, setBookingNumber] = useState('');
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { setReservation(await publicApi.lookupBooking({ bookingNumber, emailOrMobile })); } catch (requestError) { setError((requestError as { userMessage?: string }).userMessage ?? 'We could not find that booking.'); } finally { setLoading(false); } };
  return <><PageIntro eyebrow="Your stay" title="Find your reservation." description="Lost your confirmation? Enter your booking reference and the contact used to make it." /><div className="mx-auto max-w-3xl px-5 pb-24 lg:px-10"><form onSubmit={submit} className="border border-ink/10 bg-white p-6 md:p-10"><div className="grid gap-5 sm:grid-cols-2"><label><span className="label-text">Booking reference</span><input className="input-field" value={bookingNumber} onChange={(event) => setBookingNumber(event.target.value.toUpperCase())} placeholder="HTL-..." required /></label><label><span className="label-text">Email or mobile</span><input className="input-field" value={emailOrMobile} onChange={(event) => setEmailOrMobile(event.target.value)} required /></label></div>{error && <p className="mt-4 text-sm text-copper">{error}</p>}<button className="button-primary mt-6" type="submit" disabled={loading}><Search size={15} />{loading ? 'Searching…' : 'Find my booking'}</button></form>{reservation && <div className="mt-6 border border-forest/20 bg-white p-6"><p className="eyebrow">Found reservation</p><h2 className="mt-2 font-display text-3xl">{reservation.guestSnapshot.fullName} · {reservation.bookingNumber}</h2><p className="mt-3 text-sm text-ink/60">{reservation.roomTypeId?.name} · {reservation.pricing.total.toLocaleString('en-IN')} total</p><Link className="button-primary mt-5" to={`/confirmation/${reservation.bookingNumber}`}>View details</Link></div>}</div></>;
}
