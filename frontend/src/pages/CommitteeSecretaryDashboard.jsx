
import { useAuth } from '../context/useAuth';
import { useCallback, useEffect, useState } from 'react';
import api, { API_BASE_URL } from '../api/api';
import { io } from 'socket.io-client';
import CommitteeMinutesList from '../components/Minutes/CommitteeMinutesList';
import OrdinanceWorkflow from '../components/Ordinances/OrdinanceWorkflow';
import '../styles/CommitteeSecretaryDashboard.css';

export default function CommitteeSecretaryDashboard() {
  const { user } = useAuth();
  const [assignedCommittees, setAssignedCommittees] = useState([]);
  const [committeeOrdinances, setCommitteeOrdinances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCommitteesAndOrdinances = useCallback(async () => {
    if (!user?.id) {
      setAssignedCommittees([]);
      setCommitteeOrdinances({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.get('/committees');
      const committeeList = res.data || [];

      // Pull full committee detail so membership changes are reflected immediately.
      const detailResults = await Promise.allSettled(
        committeeList.map((committee) => api.get(`/committees/${committee.id}`))
      );

      const committeeDetails = detailResults.map((result, index) => (
        result.status === 'fulfilled'
          ? result.value.data
          : committeeList[index]
      ));

      const filtered = committeeDetails.filter((committee) =>
        Array.isArray(committee.members)
        && committee.members.some((member) =>
          String(member.user_id) === String(user.id)
          && ['Committee Secretary', 'Secretary'].includes(String(member.role || '').trim())
        )
      );

      setAssignedCommittees(filtered);

      const ordinancesByCommittee = {};
      for (const committee of filtered) {
        try {
          const ordRes = await api.get(`/ordinances?committee_id=${committee.id}`);
          ordinancesByCommittee[committee.id] = ordRes.data || [];
        } catch {
          ordinancesByCommittee[committee.id] = [];
        }
      }
      setCommitteeOrdinances(ordinancesByCommittee);
    } catch {
      setError('Failed to load assigned committees.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCommitteesAndOrdinances();
  }, [fetchCommitteesAndOrdinances]);

  useEffect(() => {
    if (!user?.id) return;

    const socketBaseUrl = String(import.meta.env.VITE_SOCKET_URL || API_BASE_URL)
      .trim()
      .replace(/\/+$/, '');
    const socket = io(socketBaseUrl);

    const refreshCommittees = () => {
      fetchCommitteesAndOrdinances();
    };

    socket.on('committeeCreated', refreshCommittees);
    socket.on('committeeUpdated', refreshCommittees);
    socket.on('committeeDeleted', refreshCommittees);

    return () => {
      socket.off('committeeCreated', refreshCommittees);
      socket.off('committeeUpdated', refreshCommittees);
      socket.off('committeeDeleted', refreshCommittees);
      socket.disconnect();
    };
  }, [fetchCommitteesAndOrdinances, user?.id]);


  return (
    <div className="dashboard-content committee-secretary-dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user?.name || 'Committee Secretary'}!</h1>
        <p className="header-subtitle">
          Here you can manage committee meeting minutes, attendance, and assist in drafting committee reports.
        </p>
        <button type="button" className="btn-refresh" onClick={fetchCommitteesAndOrdinances}>
          Refresh
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">Loading your assigned committees...</div>
      ) : (
        <>
          <h2>Your Committees</h2>
          {assignedCommittees.length === 0 ? (
            <p>You are not assigned as a Committee Secretary to any committee.</p>
          ) : (
            assignedCommittees.map(committee => (
              <div key={committee.id} className="committee-section">
                <h3>{committee.name}</h3>
                <p>{committee.description}</p>
                <CommitteeMinutesList committeeId={committee.id} committee={committee} />
                {/* Show ordinances assigned to this committee and their workflow */}
                {committeeOrdinances[committee.id] && committeeOrdinances[committee.id].length > 0 && (
                  <div className="committee-ordinances">
                    <h4>Assigned Ordinances</h4>
                    {committeeOrdinances[committee.id].map((ordinance) => (
                      <div key={ordinance.id} className="ordinance-workflow-section">
                        <h5>{ordinance.title}</h5>
                        <OrdinanceWorkflow ordinanceId={ordinance.id} ordinance={ordinance} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
