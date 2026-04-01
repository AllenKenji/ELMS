import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';

export default function useCommitteeMinutes(committeeId) {
  const [minutes, setMinutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMinutes = useCallback(async () => {
    if (!committeeId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/committee-minutes?committee_id=${committeeId}`);
      setMinutes(res.data.minutes || []);
    } catch (err) {
      setError(err.message || 'Failed to load committee minutes');
    } finally {
      setLoading(false);
    }
  }, [committeeId]);

  useEffect(() => {
    fetchMinutes();
  }, [fetchMinutes]);

  const createMinutes = async (formData) => {
    const res = await api.post('/committee-minutes', { ...formData, committee_id: committeeId });
    await fetchMinutes();
    return res.data;
  };

  const updateMinutes = async (id, updates) => {
    const res = await api.put(`/committee-minutes/${id}`, updates);
    await fetchMinutes();
    return res.data;
  };

  const deleteMinutes = async (id) => {
    await api.delete(`/committee-minutes/${id}`);
    await fetchMinutes();
  };

  const getMinutesById = async (id) => {
    const res = await api.get(`/committee-minutes/${id}`);
    return res.data;
  };

  return {
    minutes,
    loading,
    error,
    fetchMinutes,
    createMinutes,
    updateMinutes,
    deleteMinutes,
    getMinutesById,
  };
}
