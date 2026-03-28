import { useNavigate } from 'react-router-dom';
import { addUser } from '../redux/action/allActions';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Constants from './Constants';
import { useAuth } from '../contexts/Authentication';
// import { Authentication } from '../contexts/Authentication';

function LogOut() {

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [loader, setLoader] = useState(true)
    const { logout } = useAuth();

    useEffect(() => {
        dispatch(addUser(null));

        // Local Storage
        localStorage.setItem('login',false);
        localStorage.setItem('user', null);
        localStorage.setItem('token', null);
        localStorage.clear();
        logout();
        navigate(Constants.LOGIN_ROUTE, { replace: true });
        
        setLoader(false)
    });

    return (
        <>
            {loader && <div className="d-flex justify-content-center" style={{background:"(255,255,255,0)"}}>
                <div className="spinner-border text-danger" style={{width:"3rem", height:"3rem"}} role="status">
                    <span className="sr-only">Loading...</span>
                </div>
            </div>}
        </>
    )

}

export default LogOut;