import { format, formatDistanceToNowStrict } from 'date-fns';

export const taka = (n) => `৳${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const dateTime = (d) => format(new Date(d), 'EEE, d MMM yyyy · h:mm a');
export const shortDate = (d) => format(new Date(d), 'd MMM yyyy');
export const fromNow = (d) => formatDistanceToNowStrict(new Date(d), { addSuffix: true });
export const toInputDateTime = (d) => (d ? format(new Date(d), "yyyy-MM-dd'T'HH:mm") : '');

export const EVENT_TYPES = [
  { value: 'CONCERT', label: 'Concert' },
  { value: 'TRANSPORT', label: 'Bus / Train' },
  { value: 'ROOM', label: 'Rooms' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'THEATRE', label: 'Theatre' },
  { value: 'CONFERENCE', label: 'Conference' },
];

export const typeLabel = (t) => EVENT_TYPES.find((x) => x.value === t)?.label || t;
