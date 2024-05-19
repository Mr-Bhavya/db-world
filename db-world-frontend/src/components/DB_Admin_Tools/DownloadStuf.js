import React, { useEffect, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import Mirror from './Mirror';
import Youtube_dl from './Youtube_dl';
import Clone from './Clone';


function DownloadStuf() {

    const [selectDownloader, setSelectDownloder] = useState("mirror");
    let returnStuf;

    if (selectDownloader === "youtube") {
        returnStuf = <Youtube_dl />
    } else if (selectDownloader === "mirror") {
        returnStuf = <Mirror />
    } 
    // else if (selectDownloader === "clone") {
    //     returnStuf = <Clone />
    // }

    return (
        <div className="bg-transparent m-1">

            <div>
                <div className='mx-3'>
                    <select className="form-select form-select-lg my-1"
                        aria-label=".form-select-lg example"
                        onChange={(e) => setSelectDownloder(e.target.value)}
                    >
                        <option selected={selectDownloader === "mirror" ? true : false} value="mirror">Mirror</option>
                        {/* <option selected={selectDownloader === "clone" ? true : false} value="clone">Clone</option> */}
                        <option selected={selectDownloader === "youtube" ? true : false} value="youtube">Youtube</option>
                    </select>
                </div>
                {returnStuf}
            </div>

            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
        </div>
    )

}

export default DownloadStuf;