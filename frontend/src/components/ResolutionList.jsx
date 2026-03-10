// components/ResolutionList.jsx
export default function ResolutionList({ resolutions }) {
  const safeResolutions = Array.isArray(resolutions) ? resolutions : [];

  return (
    <div>
      <h3>Resolutions</h3>
      <ul>
        {safeResolutions.map(r => (
          <li key={r.id}>{r.title} — {r.status}</li>
        ))}
      </ul>
    </div>
  );
}
