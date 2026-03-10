// components/UserManagement.jsx
import { useState, useEffect } from 'react';
import api from '../api/api';

export default function UserManagement({ users }) {
  const [allUsers, setAllUsers] = useState(users || []);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });

  useEffect(() => {
    // Fetch users if not passed in
    if (!users) {
      api.get('/users').then(res => setAllUsers(res.data));
    }
  }, [users]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/register', form);
      setAllUsers(prev => [...prev, res.data]);
      setForm({ name: '', email: '', password: '', roleId: '' });
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      setAllUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>User Management</h3>

      {/* Add User Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <select name="roleId" value={form.roleId} onChange={handleChange} required>
          <option value="">Select Role</option>
          <option value="1">Secretary</option>
          <option value="2">Councilor</option>
          <option value="3">Captain</option>
          <option value="4">DILG</option>
          <option value="5">Resident</option>
          <option value="6">Admin</option>
        </select>
        <button type="submit">Add User</button>
      </form>

      {/* User List */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th>Name</th>
            <th>Email</th>
            <th>Role ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allUsers.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role_id}</td>
              <td>
                <button onClick={() => handleDelete(u.id)} style={{ color: 'red' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
