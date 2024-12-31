import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addUser } from '../redux/action/allActions';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({
        isAuthenticated: localStorage.getItem('login'), role: null, user: localStorage.getItem('user'), token: localStorage.getItem('token')
    })
    const dispatch = useDispatch();

    const login = (token, user) => {
        setAuth({
            isAuthenticated: true,
            user, token, role: null
        })
        localStorage.setItem('login', true);
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user));
        dispatch(addUser(user));
    }

    const logout = () => {
        // localStorage.removeItem('login');
        // localStorage.removeItem('token')
        // localStorage.removeItem('user');
        // localStorage.removeItem('role');
        setAuth({
            isAuthenticated: null,
            user: null, token: null,
            role: null
        })
    }

    const setUserRole = (role) => {
        setAuth([...auth, role])
    }

    useEffect(() => {
        setAuth({
            isAuthenticated: localStorage.getItem('login') === 'true', role: null, user: localStorage.getItem('user'), token: localStorage.getItem('token')
        })
    }, []);

    return (
        <AuthContext.Provider
            value={{ auth, setUserRole, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    )

}

const useAuth = () => useContext(AuthContext);

export default {
    AuthProvider,
    useAuth
}