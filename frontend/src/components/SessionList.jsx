// components/SessionList.jsx
export default function SessionList({ sessions }) {
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  return (
    <div>
      <h3>Sessions</h3>
      <ul>
        {safeSessions.map(s => (
          <li key={s.id}>{s.date} — {s.agenda}</li>
        ))}
      </ul>
    </div>
  );
}
