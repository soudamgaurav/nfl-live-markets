import { useEffect, useState } from 'react';
import { useSocketStatus } from '../hooks/useSocketStatus';
import { marketSocket } from '../lib/live';

const LABELS = {
  idle: 'Not connected',
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
} as const;

function sinceText(ts: number | null, now: number): string | null {
  if (ts === null) return null;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 2) return 'updated just now';
  if (s < 60) return `updated ${s}s ago`;
  return `updated ${Math.floor(s / 60)}m ago`;
}

export function ConnectionStatus() {
  const status = useSocketStatus();
  const [now, setNow] = useState(() => Date.now());

  // Only this small badge ticks every second; the table is untouched.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const since = status === 'live' ? sinceText(marketSocket.lastMessageAt, now) : null;

  return (
    <p className={`conn conn-${status}`} role="status">
      <span className="conn-dot" aria-hidden="true" />
      <span>{LABELS[status]}</span>
      {since && <span className="conn-since">{since}</span>}
    </p>
  );
}
