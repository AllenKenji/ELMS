import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';

export default function useMinutes() {
  const [minutes, setMinutes] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    status: '',
    sort: 'created_at',
    order: 'DESC',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMinutes = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page,
          limit: pagination.limit,
          ...filters,
        };
        Object.keys(params).forEach((k) => {
          if (params[k] === '') delete params[k];
        });

        const res = await api.get('/minutes', { params });
        setMinutes(res.data.minutes || []);
        setPagination(res.data.pagination || {});
      } catch (err) {
        setError(err.message || 'Failed to load meeting minutes');
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit, pagination.page]
  );

  useEffect(() => {
    fetchMinutes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const createMinutes = async (formData) => {
    const res = await api.post('/minutes', formData);
    await fetchMinutes(1);
    return res.data;
  };

  const generateMinutes = async (id) => {
    const res = await api.post(`/minutes/${id}/generate`);
    setMinutes((prev) => prev.map((m) => (m.id === id ? res.data : m)));
    return res.data;
  };

  const updateMinutes = async (id, updates) => {
    const res = await api.put(`/minutes/${id}`, updates);
    setMinutes((prev) => prev.map((m) => (m.id === id ? res.data : m)));
    return res.data;
  };

  const deleteMinutes = async (id) => {
    await api.delete(`/minutes/${id}`);
    setMinutes((prev) => prev.filter((m) => m.id !== id));
  };

  const getMinutesById = async (id) => {
    const res = await api.get(`/minutes/${id}`);
    return res.data;
  };

  const exportText = (id) => {
    const token = localStorage.getItem('accessToken');
    const baseURL = api.defaults.baseURL || 'http://localhost:5000';
    const url = `${baseURL}/minutes/${id}/export/text`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `minutes_${id}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(() => setError('Failed to export minutes'));
  };

  const changePage = (page) => {
    setPagination((prev) => ({ ...prev, page }));
    fetchMinutes(page);
  };

  const applyFilters = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return {
    minutes,
    pagination,
    filters,
    loading,
    error,
    fetchMinutes,
    createMinutes,
    generateMinutes,
    updateMinutes,
    deleteMinutes,
    getMinutesById,
    exportText,
    changePage,
    applyFilters,
  };
}
