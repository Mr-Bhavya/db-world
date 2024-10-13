import React, { useEffect, useState } from 'react'
import userProfile from '../../images/UserProfile.png';
import { useNavigate } from 'react-router-dom';
import Authentication from '../Authentication';
import Constants from '../Constants';
import { getUserDetailByUserId } from '../ApiServices';

function Profile(props) {

    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [loading, setLoading] = useState(true)

    const getDetails = async (userId) => {
        let getUserRes = await getUserDetailByUserId(userId);
        if (getUserRes.httpStatusCode === 200) {
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



        // CommonServices.valiadteToken().then(async isValidToken => {
        //     if (!isValidToken) {
        //         navigate(await Constants.REDIRECT(Constants.EDIT_USER_PROFILE_ROUTE), { replace: true })
        //     } else {
        //         let authenticationRes = Authentication({ redirectTo: Constants.USER_PROFILE_ROUTE });
        //         if (authenticationRes.login) {
        //             setUserData(props.userData ? props.userData : authenticationRes.user)
        //             setLoading(false);
        //         }
        //         else {
        //             navigate(authenticationRes.redirectUrl, { replace: true });
        //         }
        //     }
        // }).catch(err => {
        //     console.log(err);
        // });
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
                                                <td>No. Of Logins </td><td>{userData.userAppData?.noOfLogin}</td>
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
