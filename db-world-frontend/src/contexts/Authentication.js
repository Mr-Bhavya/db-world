// contexts/Authentication.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addUser } from '../redux/action/allActions';
import axiosInstance from '../components/Utils/AxiosInstants';
import { logOut, verify } from '../components/ApiServices';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
    token: null,
    role: null,
    loading: true,
  });

  const login = useCallback((token, user, role = null) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('role', role);

    setAuth({
      isAuthenticated: true,
      token,
      user,
      role,
      loading: false,
    });

    dispatch(addUser(user));
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await logOut()
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.clear();
      setAuth({
        isAuthenticated: false,
        user: null,
        token: null,
        role: null,
        loading: false,
      });
    }
  }, []);

  const setUserRole = useCallback((role) => {
    localStorage.setItem('role', role);
    setAuth(prev => ({ ...prev, role }));
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || 'null');

      if (!token || !user) {
        setAuth(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const response =await verify()
        const roles = response?.roles || [];
        const role = roles[0] || null;

        if (role) {
          login(token, user, role);
        } else {
          logout();
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        logout();
      }
    };

    checkAuth();
  }, [login, logout]);

  return (
    <AuthContext.Provider value={{ auth, setUserRole, login, logout }}>
      {auth.loading ? <div>Loading...</div> : children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

export { AuthProvider, useAuth };
