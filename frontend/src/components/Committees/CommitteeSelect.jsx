import { useState, useEffect } from 'react';
import api from '../../api/api';

export default function CommitteeSelect({ value, onChange, disabled }) {
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCommittees() {
      try {
        setLoading(true);
        const res = await api.get('/committees');
        setCommittees(res.data || []);
      } finally {
        setLoading(false);
      }
    }
    fetchCommittees();
  }, []);

  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled || loading}>
      <option value="">Select Committee...</option>
      {committees.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
