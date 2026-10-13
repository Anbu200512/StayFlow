import { useEffect } from 'react';
import { ArrowLeft, BedDouble, Check, Maximize2, ShieldCheck, Users } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { roomQuery } from '../lib/queries';
import { useBookingStore } from '../store/bookingStore';
import { ErrorState, LoadingState, PageIntro } from '../components/States';

export default function RoomDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const checkIn = params.get('checkIn') ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const checkOut = params.get('checkOut') ?? new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const { data, isLoading, isError, refetch } = roomQuery(id, { checkIn, checkOut });
  const setSearch = useBookingStore((state) => state.setSearch);
  const setSelectedRoom = useBookingStore((state) => state.setSelectedRoom);
  const room = data;
  useEffect(() => { if (data) document.title = `${data.roomType.name} · Alder House`; }, [data]);
  if (isLoading) return <LoadingState label="Loading room" />;
  if (isError || !room) return <ErrorState message="We could not find that room." onRetry={() => refetch()} />;
  const type = room.roomType;
  const roomId = room._id ?? room.id ?? '';
  const price = room.nightlyRate?.min ?? type.basePrice;
  const book = () => { setSelectedRoom(roomId); setSearch({ checkIn, checkOut, adults: Number(params.get('adults') ?? 2), children: Number(params.get('children') ?? 0) }); navigate(`/booking?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${params.get('adults') ?? 2}&children=${params.get('children') ?? 0}`); };
  return <><PageIntro eyebrow={`Room ${room.roomNumber} · Floor ${room.floor}`} title={type.name} description={type.description} /><div className="mx-auto max-w-7xl px-5 pb-24 lg:px-10"><Link to="/rooms" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-forest"><ArrowLeft size={15} />Back to rooms</Link><div className="mt-8 grid gap-10 lg:grid-cols-[1.25fr_0.75fr]"><div><div className="grid gap-3 sm:grid-cols-2">{[...type.images, ...(type.images.length ? [] : [])].slice(0, 2).map((image, index) => <img key={`${image.publicId}-${index}`} src={image.url} alt={image.alt ?? type.name} className="aspect-[1.4] h-full w-full object-cover" />)}</div><div className="mt-10 grid gap-4 border-t border-ink/10 pt-8 sm:grid-cols-3"><Spec icon={<BedDouble size={18} />} label="Bed" value={type.bedConfiguration} /><Spec icon={<Users size={18} />} label="Sleeps" value={`${type.maxAdults} adults, ${type.maxChildren} children`} /><Spec icon={<Maximize2 size={18} />} label="Size" value={type.sizeSqm ? `${type.sizeSqm} m²` : 'Generous'} /></div></div><aside className="h-fit border border-ink/10 bg-white p-7 shadow-soft"><p className="eyebrow">From</p><p className="mt-2 font-display text-5xl text-forest">₹{price.toLocaleString()}<span className="font-sans text-xs font-normal tracking-normal text-ink/45"> / night</span></p>{room.nightlyRate && <p className="mt-2 text-xs text-ink/45">{room.nightlyRate.nights} night{room.nightlyRate.nights === 1 ? '' : 's'} · ₹{room.nightlyRate.total.toLocaleString()} total</p>}<div className="mt-7 space-y-3 border-y border-ink/10 py-6">{type.amenities.map((amenity) => <p key={amenity} className="flex items-center gap-3 text-sm text-ink/65"><Check size={15} className="text-forest" />{amenity}</p>)}</div><button type="button" className="button-primary mt-7 w-full" onClick={book}>Book this room</button><p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-ink/45"><ShieldCheck size={14} />Best rate, direct booking</p></aside></div><div className="mt-16 grid gap-8 border-t border-ink/10 pt-10 md:grid-cols-2"><div><p className="eyebrow">Good to know</p><h2 className="mt-3 font-display text-3xl">A room designed around you.</h2></div><p className="text-sm leading-7 text-ink/60">Every Alder House room includes high-speed Wi-Fi, climate control, premium bedding, and a quiet workspace. Our team is available around the clock for anything you need during your stay.</p></div></div></>;
}
function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div><div className="text-forest">{icon}</div><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">{label}</p><p className="mt-1 text-sm text-ink/70">{value}</p></div>; }
