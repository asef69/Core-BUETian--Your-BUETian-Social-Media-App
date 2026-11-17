// Bangladesh Standard Time (Asia/Dhaka, UTC+06:00, no daylight saving).
//
// The Django backend runs with TIME_ZONE = 'Asia/Dhaka' and returns either
// offset-aware ISO strings (+06:00) or naive timestamps that are stored in UTC.
// Every date shown in the UI goes through this module so users always see
// Bangladesh time, whatever timezone their device is set to.

import moment from 'moment';

export const APP_TIME_ZONE = 'Asia/Dhaka';
const DHAKA_OFFSET = '+06:00';

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a timestamp from the API into a Date.
 * - Date-only values ("2026-05-01") are a calendar day in Dhaka.
 * - Strings with an offset or "Z" are used as-is.
 * - Naive strings ("2026-05-01 10:30:00") are stored in UTC by the backend.
 */
export const parseServerDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  let date;
  if (typeof value === 'string') {
    const text = value.trim();
    if (DATE_ONLY.test(text)) {
      date = new Date(`${text}T00:00:00${DHAKA_OFFSET}`);
    } else if (HAS_ZONE.test(text)) {
      date = new Date(text);
    } else {
      date = new Date(`${text.replace(' ', 'T')}Z`);
    }
  } else {
    date = new Date(value);
  }
  return Number.isNaN(date.getTime()) ? null : date;
};

const makeFormatter = (options) => {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, ...options });
  return (value) => {
    const date = parseServerDate(value);
    return date ? formatter.format(date) : '';
  };
};

const dateFormatter = makeFormatter({ day: 'numeric', month: 'short', year: 'numeric' });
const timeFormatter = makeFormatter({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateTimeFormatter = makeFormatter({
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const weekdayDateFormatter = makeFormatter({
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE });

/** "17 Nov 2026" */
export const formatDate = dateFormatter;
/** "14:05" (24h, Bangladesh time) */
export const formatTime = timeFormatter;
/** "17 Nov 2026, 2:05 pm" */
export const formatDateTime = dateTimeFormatter;
/** "Tuesday, 17 November 2026" (chat date separators) */
export const formatLongDate = weekdayDateFormatter;

/** Calendar-day key in Dhaka ("2026-11-17"), for grouping messages by day. */
export const dhakaDayKey = (value) => {
  const date = parseServerDate(value);
  return date ? dayKeyFormatter.format(date) : '';
};

/** Relative time: "5 minutes ago". Independent of timezone. */
export const timeAgo = (value) => {
  const date = parseServerDate(value);
  return date ? moment(date).fromNow() : '';
};

/** Epoch milliseconds for sorting; 0 when the value is missing or invalid. */
export const toTimestamp = (value) => {
  const date = parseServerDate(value);
  return date ? date.getTime() : 0;
};

/** Value for <input type="datetime-local">, expressed in Dhaka time. */
export const toDhakaInputValue = (value) => {
  const date = parseServerDate(value);
  if (!date) return '';
  const shifted = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
};

/** Convert a <input type="datetime-local"> value (Dhaka time) to a UTC ISO string. */
export const dhakaInputToISO = (inputValue) => {
  if (!inputValue) return null;
  const withSeconds = inputValue.length === 16 ? `${inputValue}:00` : inputValue;
  const date = new Date(`${withSeconds}${DHAKA_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Conversation-list stamp: "14:05", "Yesterday" or "17 Nov 2026" (Bangladesh time). */
export const formatListTime = (value) => {
  const date = parseServerDate(value);
  if (!date) return '';
  const key = dhakaDayKey(date);
  if (key === dhakaDayKey(new Date())) return formatTime(date);
  if (key === dhakaDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return formatDate(date);
};

/** Chat date-separator label: "Today", "Yesterday" or "Tuesday, 17 November 2026". */
export const formatDayLabel = (value) => {
  const date = parseServerDate(value);
  if (!date) return '';
  const key = dhakaDayKey(date);
  if (key === dhakaDayKey(new Date())) return 'Today';
  if (key === dhakaDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return formatLongDate(date);
};
