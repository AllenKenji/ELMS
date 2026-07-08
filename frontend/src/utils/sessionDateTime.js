function parseDateOnlyToLocalDate(dateValue) {
  const raw = String(dateValue || '').slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(year, monthIndex, day);
}

function parseSessionTimeParts(sessionTime) {
  const hhmm = String(sessionTime || '').match(/^(\d{2}):(\d{2})/) || [];
  const hour = Number(hhmm[1]);
  const minute = Number(hhmm[2]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return { hour, minute };
}

export function formatSessionClock(sessionTime) {
  const parts = String(sessionTime || '').split(':');
  if (parts.length < 2) {
    return 'Time not specified';
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return 'Time not specified';
  }

  const normalizedHour = ((hour % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const hour12 = normalizedHour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function getSessionStartDateTime(session) {
  const sessionDay = parseDateOnlyToLocalDate(session?.date);
  const timeParts = parseSessionTimeParts(session?.session_time);

  if (!sessionDay || !timeParts) {
    return null;
  }

  const start = new Date(sessionDay);
  start.setHours(timeParts.hour, timeParts.minute, 0, 0);
  return start;
}

export function getSessionStatus(session, now = new Date()) {
  const startDateTime = getSessionStartDateTime(session);
  if (startDateTime) {
    const durationMinutes = Number(session?.total_oob_minutes || 120);
    const normalizedDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 120;
    const endDateTime = new Date(startDateTime.getTime() + (normalizedDuration * 60 * 1000));

    if (now < startDateTime) return 'Upcoming';
    if (now >= startDateTime && now <= endDateTime) return 'Active';
    return 'Completed';
  }

  const sessionDay = parseDateOnlyToLocalDate(session?.date);
  if (!sessionDay) {
    return 'Upcoming';
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  sessionDay.setHours(0, 0, 0, 0);

  return sessionDay >= today ? 'Upcoming' : 'Completed';
}

export function isSessionUpcoming(session, now = new Date()) {
  return getSessionStatus(session, now) !== 'Completed';
}

export function isSessionStrictUpcoming(session, now = new Date()) {
  const startDateTime = getSessionStartDateTime(session);
  if (startDateTime) {
    return startDateTime > now;
  }

  const sessionDay = parseDateOnlyToLocalDate(session?.date);
  if (!sessionDay) {
    return false;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  sessionDay.setHours(0, 0, 0, 0);

  return sessionDay > today;
}

export function getSessionDateKey(session) {
  const d = parseDateOnlyToLocalDate(session?.date);
  if (!d) {
    return null;
  }

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
