import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiUser } from '../services/api.ts';

interface AuthContextType {
  user: ApiUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchRole: (role: 'ADMIN' | 'STAFF' | 'CUSTOMER') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('aegispass_token');
      if (!token) {
        // Auto-login as default guest customer for pleasant first-time user experience
        await switchRole('CUSTOMER');
        return;
      }
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        localStorage.removeItem('aegispass_token');
        setUser(null);
      }
    } catch (err) {
      console.error('Auth verification error:', err);
      localStorage.removeItem('aegispass_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.success && res.token) {
      localStorage.setItem('aegispass_token', res.token);
      setUser(res.user);
      return { success: true };
    }
    return { success: false, message: res.message || 'Login failed.' };
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.register(name, email, password);
    if (res.success && res.token) {
      localStorage.setItem('aegispass_token', res.token);
      setUser(res.user);
      return { success: true };
    }
    return { success: false, message: res.message || 'Registration failed.' };
  };

  const logout = () => {
    localStorage.removeItem('aegispass_token');
    setUser(null);
  };

  const switchRole = async (role: 'ADMIN' | 'STAFF' | 'CUSTOMER') => {
    setLoading(true);
    let email = 'guest@example.com';
    let password = 'Guest@Pass123';

    if (role === 'ADMIN') {
      email = 'admin@example.com';
      password = 'Admin@Pass123';
    } else if (role === 'STAFF') {
      email = 'staff@example.com';
      password = 'Staff@Pass123';
    }

    try {
      const res = await api.login(email, password);
      if (res.success && res.token) {
        localStorage.setItem('aegispass_token', res.token);
        setUser(res.user);
      }
    } catch (err) {
      console.error('Failed to switch preset role:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
