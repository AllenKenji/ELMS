import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import "../styles/Login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-fill remembered email
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedEmail');
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedEmail = email.trim();
    const normalizedPassword = password;

    try {
      const res = await axios.post('http://localhost:5000/auth/login', {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      const { accessToken, refreshToken, user } = res.data;

      if (!accessToken || !refreshToken) {
        throw new Error("Invalid login response");
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      onLogin({ accessToken, refreshToken, user });
    } catch (err) {
      const validationDetails = err.response?.data?.details;
      if (Array.isArray(validationDetails) && validationDetails.length > 0) {
        setError(validationDetails.map((d) => d.message).join(' '));
        return;
      }

      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.request ? 'Server unreachable' : 'Unexpected error');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Title separated from login box */}
      <div className="system-header">
        <h1>
        <span className="title-bold">E‑Legislative</span><br />
        <span className="title-bold">Management</span> <span className="title-light">System</span>
        </h1>
      </div>

      <div className="login-container">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password:</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <span
              className="eye-icon"
              onClick={() => setShowPassword(!showPassword)}
              role="button"
              aria-label="Toggle password visibility"
            >
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>
          
          <div className="remember-me">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe">Remember Me</label>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-links">
          <Link to="/forgot-password">Forgot Password?</Link>
          <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
