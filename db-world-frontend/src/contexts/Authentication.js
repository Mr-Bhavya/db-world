import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addUser } from '../redux/action/allActions';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
    token: null,
    role: null,
  });

  // Called after successful login
  const login = (token, user, role = null) => {
    localStorage.setItem('login', 'true');
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('role', role);
    setAuth({
      isAuthenticated: true,
      token,
      user,
      role,
    });
    dispatch(addUser(user));
  };

  const logout = () => {
    localStorage.clear();
    setAuth({
      isAuthenticated: false,
      user: null,
      token: null,
      role: null,
    });
  };

  const setUserRole = (role) => {
    localStorage.setItem('role', role);
    setAuth(prev => ({ ...prev, role }));
  };

  useEffect(() => {
    const login = localStorage.getItem('login') === 'true';
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (login && user && token) {
      setAuth({
        isAuthenticated: true,
        user,
        token,
        role,
      });
      dispatch(addUser(user));
    }
  }, [dispatch]);

  return (
    <AuthContext.Provider value={{ auth, setUserRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

export default {
  AuthProvider,
  useAuth,
};
