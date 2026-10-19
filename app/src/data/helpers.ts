import { contentItems } from './content';
import type { ContentItem } from './types';

const COPENHAGEN_TIME_ZONE = 'Europe/Copenhagen';

const startOfLocalDay = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COPENHAGEN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
};

/** Returns public content whose editorial expiry date has not passed. */
export const getActiveContent = (items: ContentItem[] = contentItems, now = new Date()) => {
  const today = startOfLocalDay(now);

  return items
    .filter((item) => item.status === 'offentliggjort' && item.expiresAt.slice(0, 10) >= today)
    .sort((a, b) => (a.startAt ?? a.publishedAt).localeCompare(b.startAt ?? b.publishedAt));
};

/** Returns active events in chronological order. */
export const getUpcomingEvents = (items: ContentItem[] = contentItems, now = new Date()) =>
  getActiveContent(items, now)
    .filter((item) => item.type === 'arrangement' && Boolean(item.startAt))
    .sort((a, b) => a.startAt!.localeCompare(b.startAt!));

export const formatDate = (date: string | Date, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: COPENHAGEN_TIME_ZONE,
    ...options,
  }).format(typeof date === 'string' ? new Date(date) : date);

export const formatTime = (date: string | Date) =>
  new Intl.DateTimeFormat('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: COPENHAGEN_TIME_ZONE,
  }).format(typeof date === 'string' ? new Date(date) : date);
