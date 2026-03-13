import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';

export default function useReports() {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    status: '',
    report_type: '',
    sort: 'created_at',
    order: 'DESC',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReports = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page,
          limit: pagination.limit,
          ...filters,
        };
        // Remove empty string params
        Object.keys(params).forEach((k) => {
          if (params[k] === '') delete params[k];
        });

        const res = await api.get('/reports', { params });
        setReports(res.data.reports || []);
        setPagination(res.data.pagination || {});
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit, pagination.page]
  );

  useEffect(() => {
    fetchReports(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const createReport = async (formData) => {
    const res = await api.post('/reports', formData);
    await fetchReports(1);
    return res.data;
  };

  const updateReport = async (id, updates) => {
    const res = await api.put(`/reports/${id}`, updates);
    setReports((prev) => prev.map((r) => (r.id === id ? res.data : r)));
    return res.data;
  };

  const deleteReport = async (id) => {
    await api.delete(`/reports/${id}`);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const getReport = async (id) => {
    const res = await api.get(`/reports/${id}`);
    return res.data;
  };

  const exportCsv = (id) => {
    const token = localStorage.getItem('accessToken');
    const baseURL = api.defaults.baseURL || 'http://localhost:5000';
    const url = `${baseURL}/reports/${id}/export/csv`;
    // Create a temporary anchor for download with auth header via fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `report_${id}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(() => setError('Failed to export CSV'));
  };

  const exportPdf = async (id) => {
    const res = await api.get(`/reports/${id}/export/pdf`);
    return res.data;
  };

  const changePage = (page) => {
    setPagination((prev) => ({ ...prev, page }));
    fetchReports(page);
  };

  const applyFilters = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return {
    reports,
    pagination,
    filters,
    loading,
    error,
    fetchReports,
    createReport,
    updateReport,
    deleteReport,
    getReport,
    exportCsv,
    exportPdf,
    changePage,
    applyFilters,
  };
}
