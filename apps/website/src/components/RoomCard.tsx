import { ArrowUpRight, BedDouble, Maximize2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Room } from '../types';

const fallbackImage = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

export function RoomCard({ room, featured = false, image }: { room: Room; featured?: boolean; image?: string }) {
  const type = room.roomType;
  const imageSrc = image ?? type.images?.[0]?.url ?? fallbackImage;
  const roomId = room._id ?? room.id;
  const price = room.nightlyRate?.min ?? type.basePrice;
  const isRange = Boolean(room.nightlyRate && room.nightlyRate.min !== room.nightlyRate.max);
  return <article className={`group ${featured ? 'lg:col-span-2' : ''}`}>
    <Link to={`/rooms/${roomId}`} className="block overflow-hidden bg-sand">
      <div className={`relative overflow-hidden ${featured ? 'aspect-[1.7]' : 'aspect-[1.35]'}`}><img src={imageSrc} alt={type.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /><span className="absolute left-4 top-4 bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-forest">{type.bedConfiguration}</span></div>
    </Link>
    <div className="border border-t-0 border-ink/10 px-5 py-5"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Room {room.roomNumber} · Floor {room.floor}</p><h3 className="mt-2 font-display text-3xl leading-none text-ink">{type.name}</h3></div><p className="text-right text-sm font-semibold text-forest">{isRange && <span className="mr-1 text-[10px] font-normal uppercase tracking-wider text-ink/45">from </span>}₹{price.toLocaleString()}<span className="block text-[10px] font-normal uppercase tracking-wider text-ink/45">per night</span></p></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-ink/60">{type.description}</p><div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-ink/55"><span className="inline-flex items-center gap-1.5"><Users size={14} />Up to {type.maxOccupancy}</span>{type.sizeSqm && <span className="inline-flex items-center gap-1.5"><Maximize2 size={14} />{type.sizeSqm} m²</span>}<span className="inline-flex items-center gap-1.5"><BedDouble size={14} />{type.amenities.slice(0, 1).join('')}</span></div><Link to={`/rooms/${roomId}`} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-forest">View room <ArrowUpRight size={15} className="transition group-hover:translate-x-1 group-hover:-translate-y-1" /></Link></div>
  </article>;
}
