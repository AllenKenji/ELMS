// components/AuditLogList.jsx
import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';

export default function AuditLogList({ logs }) {
  const [fetchedLogs, setFetchedLogs] = useState([]);

  useEffect(() => {
    if (Array.isArray(logs)) return;

    api
      .get('/audit-logs')
      .then((res) => setFetchedLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFetchedLogs([]));
  }, [logs]);

  const safeLogs = useMemo(() => {
    if (Array.isArray(logs)) return logs;
    return Array.isArray(fetchedLogs) ? fetchedLogs : [];
  }, [logs, fetchedLogs]);

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>Audit Logs</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {safeLogs.map((log, idx) => (
            <tr key={idx}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.user}</td>
              <td>{log.action}</td>
              <td>{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
