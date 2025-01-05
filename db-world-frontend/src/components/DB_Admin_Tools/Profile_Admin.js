import React, { useEffect, useState } from 'react'
import CommonServices from '../CommonServices'
import HtmlJsonTable from 'react-json-to-html-table';

const Profile_Admin = (props) => {
    var { userData } = props;
    const [loader, setLoader] = useState(true);

    useEffect(() => {
        if (userData && userData.userLoginDetails && userData.userLoginDetails.length > 0) {
            userData.userLoginDetails.map(userLoginDetail => {
                if (typeof (userLoginDetail.timeStamp) !== 'object')
                    userLoginDetail.timeStamp = CommonServices.getTimeDateFromTimeStamp(userLoginDetail.timeStamp);
            })
        }
        setLoader(false);
    }, [])

    return (
        <div>
            {
                loader &&
                <div className="col-md-8">
                    <div className='d-flex justify-content-center'>
                        <div className="spinner-border text-danger m-5" role="status">
                            <span className="sr-only text-center" />
                        </div>
                    </div>
                </div>
                ||
                <div style={{ width: "100%", overflowX: "auto" }} >
                    {/* <HtmlJsonTable data={userData} className="table table-sm table-striped table-bordered table-responsive" /> */}
                    <CommonServices.JSONToHTMLTable data={userData} />
                </div>
                // <CommonServices.JSONToHTMLTable data={userData} style={{ overflowX: "auto", width: "20rem", display: "block" }} />
            }

        </div>
    )
}

export default Profile_Admin