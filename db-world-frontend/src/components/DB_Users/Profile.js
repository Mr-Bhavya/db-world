import React, { useEffect, useState } from 'react'
import userProfile from '../../images/UserProfile.png';
import { useNavigate } from 'react-router-dom';
import Authentication from '../Authentication';
import Constants from '../Constants';
import { getUserDetail, getUserDetailByUserId } from '../ApiServices';

function Profile(props) {

    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [loading, setLoading] = useState(true)

    const getDetails = async () => {
        let getUserRes = await getUserDetail();
        if (getUserRes.httpStatusCode === 200) {
            if(getUserRes.data[0].dob && getUserRes.data[0].dob != null){
                let dob = new Intl.DateTimeFormat('fr-ca', {year: 'numeric', month: '2-digit',day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(new Date(getUserRes.data[0].dob)).split(" ")[0];
                getUserRes.data[0].dob = dob;
            }
            setUserData(getUserRes.data[0])
            setLoading(false);
        }else if (getUserRes.httpStatusCode === 401 || getUserRes.httpStatusCode === 403) {
            navigate(await Constants.REDIRECT(Constants.USER_PROFILE_ROUTE));
        }
    }

    useEffect(() => {

        let authenticationRes = Authentication({ redirectTo: Constants.USER_PROFILE_ROUTE });
        if (authenticationRes.login) {
            getDetails(authenticationRes.user.userId);
        }
        else {
            navigate(authenticationRes.redirectUrl, { replace: true });
        }
    }, [])

    return (
        <form methos="GET">
            <div className="card m-1" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>

                <div className="row g-0">
                    <div className="col-md-6">
                        <h5 className="card-title col-md-5 mt-3 ms-3 mb-3">User Profile</h5>
                    </div>
                    <hr />
                    <div className="col-md-3">
                        <img src={userProfile} className="img-fluid rounded-start" alt="No Photo" />
                    </div>
                    {loading ?
                        <div className="col-md-8">
                            <div className='d-flex justify-content-center'>
                                <div className="spinner-border text-danger m-5" role="status">
                                    <span className="sr-only text-center" />
                                </div>
                            </div>
                        </div>
                        :
                        <div className="col-md-8">
                            <div className="card-body">
                                <div className="table-responsive">
                                    <table className="table align-middle">
                                        <thead className="table-dark">
                                            <th colspan="2" ><h5 className="card-title">{userData.firstName} {userData.lastName}</h5></th>
                                        </thead>
                                        <tbody>

                                            {
                                                userData.dob ? <tr >
                                                    <td>DOB</td><td>{userData.dob}</td>
                                                </tr> : <tr>
                                                    <td>Age</td><td>{userData.age}</td>
                                                </tr>
                                            }
                                            <tr>
                                                <td>Gender</td><td>{userData.gender}</td>
                                            </tr>
                                            <tr>
                                                <td>Mobile Number</td><td>{userData.mobileNo}</td>
                                            </tr>
                                            <tr>
                                                <td>Email Id</td><td>{userData.email}</td>
                                            </tr>
                                            <tr>
                                                <td>No. Of Logins </td><td>{userData?.noOfLogin}</td>
                                            </tr>
                                            <tr>
                                                <td>Role </td><td>{userData?.userRole?.name}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <hr />
                                <p className="card-text"><small className="text-muted">
                                    <div className="d-flex justify-content-center mb-1">
                                        <p className="card-text md-auto">Do you want to Edit your Profile ?</p>
                                    </div>
                                    <div className="d-flex justify-content-center mb-1">
                                        <button className="btn btn-outline-primary btn-sm 1" type="submit" onClick={() => navigate(Constants.EDIT_USER_PROFILE_ROUTE, {
                                            state: { userData }
                                        })}>Edit Profile ✍</button>
                                    </div>
                                </small></p>
                            </div>
                        </div>
                    }
                </div>
            </div>
        </form >
    )
}

export default Profile;
