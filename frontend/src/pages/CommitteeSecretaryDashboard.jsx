
import { useAuth } from '../context/useAuth';
import { useEffect, useState } from 'react';
import api from '../api/api';
import CommitteeMinutesList from '../components/Minutes/CommitteeMinutesList';
import OrdinanceWorkflow from '../components/Ordinances/OrdinanceWorkflow';
import '../styles/CommitteeSecretaryDashboard.css';

export default function CommitteeSecretaryDashboard() {
  const { user } = useAuth();
  const [assignedCommittees, setAssignedCommittees] = useState([]);
  const [committeeOrdinances, setCommitteeOrdinances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  useEffect(() => {
    const fetchCommitteesAndOrdinances = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/committees');
        const filtered = (res.data || []).filter(c =>
          Array.isArray(c.members) && c.members.some(m => m.user_id === user.id && m.role === 'Committee Secretary')
        );
        setAssignedCommittees(filtered);

        // Fetch ordinances for each committee
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
    };
    fetchCommitteesAndOrdinances();
  }, [user.id]);


  return (
    <div className="dashboard-content committee-secretary-dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user?.name || 'Committee Secretary'}!</h1>
        <p className="header-subtitle">
          Here you can manage committee meeting minutes, attendance, and assist in drafting committee reports.
        </p>
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
                <CommitteeMinutesList committeeId={committee.id} />
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
