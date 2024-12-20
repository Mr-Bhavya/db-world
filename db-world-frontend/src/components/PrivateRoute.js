import React, { useEffect, useState } from 'react';
import Authentication from '../contexts/Authentication';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Constants from './Constants';
import { getUserRole } from './ApiServices';
import ErrorPage from './ErrorPage';
const sessionCache = { isValid: false, timestamp: null };

const PrivateRoute = ({ allowedRoles }) => {
    const { auth, logout } = Authentication.useAuth();
    const [isValid, setIsValid] = useState(null);
    const [isAllowed, setIsAllowed] = useState(null);
    const location = useLocation();

    const validateSession = async () => {
        if (sessionCache.isValid && Date.now() - sessionCache.timestamp < 5 * 60 * 1000 && auth.isAuthenticated && auth.role) {
            setIsValid(sessionCache.isValid);
            // return;
        } else {
            try {
                const roleRes = await getUserRole();
                if (roleRes.httpStatusCode === 200) {
                    auth.role = roleRes?.data?.role?.name;
                    // setUserRole(roleRes?.data?.role?.name)
                    sessionCache.isValid = allowedRoles ? allowedRoles.includes(roleRes?.data?.role?.name) : true;
                    sessionCache.timestamp = Date.now();
                    setIsValid(true);
                } else {
                    sessionCache.isValid = false;
                    sessionCache.timestamp = Date.now();
                    setIsValid(false);
                }
            } catch (ex) {
                console.error(ex);
                setIsValid(false);
            }
        }
        validateAccess();
    }

    const validateAccess = () => {
        if (allowedRoles && allowedRoles.includes(auth.role)) {
            setIsAllowed(true);
        } else {
            setIsAllowed(false); // Authorized
        }
    };

    useEffect(() => {
        validateSession();
    }, [auth, allowedRoles, location.pathname]);

    if (isValid == null) {
        return Constants.LOADER;
    } else if (isValid && !isAllowed) {
        return <ErrorPage />
    } else if (isValid && isAllowed) {
        return <Outlet />
    } else {
        return <Navigate to={Constants.LOGIN_ROUTE} state={{ from: location }} replace={true} />
    }

}

export default PrivateRoute;