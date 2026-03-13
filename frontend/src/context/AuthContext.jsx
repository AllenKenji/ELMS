// context/AuthContext.jsx
import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { Auth } from './auth';

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    const storedAccessToken = localStorage.getItem('accessToken');
    if (!storedAccessToken) return null;

    try {
      const decoded = jwtDecode(storedAccessToken);
      const now = Math.floor(Date.now() / 1000);

      if (decoded?.exp && decoded.exp <= now) {
        localStorage.removeItem('accessToken');
        return null;
      }

      return storedAccessToken;
    } catch (error) {
      console.warn('Invalid access token found in storage. Clearing auth state.', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return null;
    }
  });
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [user, setUser] = useState(() => {
    const storedAccessToken = localStorage.getItem('accessToken');
    if (!storedAccessToken) return null;

    try {
      const decoded = jwtDecode(storedAccessToken);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp <= now) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  });

  const login = (tokens) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    if (tokens.user) {
      setUser(tokens.user);
      return;
    }

    try {
      setUser(jwtDecode(tokens.accessToken));
    } catch {
      setUser(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  // 🔄 Refresh access token automatically
  useEffect(() => {
    if (!refreshToken) return;

    const refreshAccessToken = async () => {
      try {
        const res = await axios.post('http://localhost:5000/auth/refresh', {
          refreshToken,
        });
        const { accessToken: newAccessToken } = res.data;

        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
          setAccessToken(newAccessToken);
          try {
            setUser(jwtDecode(newAccessToken));
          } catch {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to refresh token:', err);
        logout();
      }
    };

    const currentToken = localStorage.getItem('accessToken');
    if (!currentToken) {
      refreshAccessToken();
    } else {
      try {
        const decoded = jwtDecode(currentToken);
        const now = Math.floor(Date.now() / 1000);
        if (decoded?.exp && decoded.exp <= now) {
          refreshAccessToken();
        }
      } catch {
        refreshAccessToken();
      }
    }

    const interval = setInterval(async () => {
      await refreshAccessToken();
    }, 14 * 60 * 1000); // refresh every 14 minutes (before 15m expiry)

    return () => clearInterval(interval);
  }, [refreshToken]);

  return (
    <Auth.Provider value={{ accessToken, refreshToken, setAccessToken, setRefreshToken, user, login, logout }}>
      {children}
    </Auth.Provider>
  );
}
