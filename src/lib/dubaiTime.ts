const DUBAI_TIMEZONE = 'Asia/Dubai';
const DUBAI_UTC_OFFSET_HOURS = 4;

const hasExplicitTimezone = (value: string) => /(?:[zZ]|[+\-]\d{2}:?\d{2})$/.test(value);

const parseDateParts = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);

  if (
    Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) ||
    Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second };
};

export const parseAuctionDateInDubai = (value?: string | null): Date | null => {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  if (hasExplicitTimezone(normalized)) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parts = parseDateParts(normalized);
  if (!parts) return null;

  // API auction date strings are interpreted as Dubai local time.
  const utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour - DUBAI_UTC_OFFSET_HOURS,
    parts.minute,
    parts.second
  );

  const parsed = new Date(utcMs);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatAuctionDateInDubai = (value?: string | null): string => {
  const date = parseAuctionDateInDubai(value);
  if (!date) return '';

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: DUBAI_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: DUBAI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return `${formattedDate} at ${formattedTime}`;
};

export const formatAuctionDateOnlyInDubai = (value?: string | null): string => {
  const date = parseAuctionDateInDubai(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: DUBAI_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};
