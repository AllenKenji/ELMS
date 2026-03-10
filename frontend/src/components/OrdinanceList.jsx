// components/OrdinanceList.jsx
export default function OrdinanceList({ ordinances }) {
  const safeOrdinances = Array.isArray(ordinances) ? ordinances : [];

  return (
    <div>
      <h3>Ordinances</h3>
      <ul>
        {safeOrdinances.map(o => (
          <li key={o.id}>{o.title} — {o.status}</li>
        ))}
      </ul>
    </div>
  );
}
