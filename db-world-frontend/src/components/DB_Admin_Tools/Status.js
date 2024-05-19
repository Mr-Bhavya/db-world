import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import Constants from '../Constants';
import LoadingSpinner from '../LoadingSpinner';
import { cancelledMirror, deleteMirror, mirrorStatus } from '../ApiServices';

function Status() {

    const [status, setStatus] = useState([])
    const [loading, setLoading] = useState(false);
    const [liveUpdate, setLiveUpdate] = useState(false);
    const [intervalNumber, setIntervalNumber] = useState();
    const navigate = useNavigate();

    const getStatus = async () => {
        // setLoading(true);
        try {
            const statusRes = await mirrorStatus();
            if (statusRes.httpStatusCode === 200) {
                setStatus(statusRes.data);
                setLoading(false)
            } else if (statusRes.httpStatusCode === 401) {
                toast.error(statusRes.message + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=status"));
                    },
                    autoClose: 500
                })
            }
            else {
                toast.error(statusRes.message);
            }
        } catch (err) {
            console.log(err);
        }
    }

    useEffect(() => {
        if (liveUpdate) {
            let interval = setInterval(async () => {
                setIntervalNumber(interval);
                await getStatus();
            }, 6000);
        }
        else {
            clearInterval(intervalNumber);
        }
    }, [liveUpdate])

    useEffect(() => {
        getStatus();
    }, [])


    const deleteStatus = async (id) => {

        try {
            const deleteRes = await deleteMirror(id);
            if(deleteRes.httpStatusCode === 200){
                toast.success(deleteRes.message);
                getStatus()
            }else if (deleteRes.httpStatusCode === 401) {
                toast.error(deleteRes.message + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=status"));
                    },
                    autoClose: 1000
                })
            }else{
                toast.error(deleteRes.message);
            }
        } catch (err) {
            console.log(err);
            toast.error("Failed.");
        }

    }

    const cancelleTask = async (statusId) => {

        const cancelleRes = await cancelledMirror(statusId);
        if (cancelleRes.httpStatusCode === 200) {
            toast.success(cancelleRes.message);
            getStatus();
        } else if (cancelleRes.httpStatusCode === 401) {
            toast.error(cancelleRes.message + Constants.RE_LOGIN, {
                onClose: async () => {
                    navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=status"));
                },
                autoClose: 1000
            })
        }
        else {
            toast.error(cancelleRes.message);
        }

    }

    const bytesToReadbleFormat = (bytes) => {

        var megabytes = bytes * 0.00000095367432;
        var kilobytes = bytes * 0.00097656;
        var gigabytes = megabytes * 0.00097656;

        if (bytes < 1024) {
            return `${bytes} bytes`
        }
        else if (kilobytes > 1 && kilobytes < 1024) {
            return `${parseFloat(kilobytes).toFixed(2)} KB`
        }
        else if (megabytes < 1024) {
            return `${parseFloat(megabytes).toFixed(2)} MB`
        }
        else if (megabytes > 1024) {
            return `${parseFloat(gigabytes).toFixed(2)} GB`
        }
    }

    function getPercentage(actual, total) {
        let percentage = parseFloat((actual * 100) / total).toFixed(2)
        return percentage;
    }


    return (
        <div className="card bg-transparent">

            {
                !loading &&
                <div>

                    <div className="row mx-3 my-3">
                        <div className="col-6 form-check form-switch d-flex">
                            <input className="form-check-input" type="checkbox" id="flexSwitchCheckDefault"
                                onClick={() => setLiveUpdate(!liveUpdate)}
                            />
                            <label className="form-check-label mx-3" htmlFor="flexSwitchCheckDefault">Live Update</label>
                        </div>
                        <div className="col-6 justify-content-end d-flex">
                            <button className='btn btn-primary'
                                onClick={() => getStatus()}
                            >Refresh Status</button>
                        </div>
                    </div>

                    {
                        status.length === 0 ?
                            <h4 className='text-warning text-center my-5'>Currently no task is running.</h4>
                            :
                            status.map((stats, key) => {
                                return (
                                    <div className="card mx-3 my-3">
                                        <span className="btn btn-danger position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                                            onClick={() => deleteStatus(stats.id)}
                                        >
                                            🗑
                                            <span className="visually-hidden">Delete</span>
                                        </span>
                                        <div className="card-header">
                                            <b>{stats.fileName}</b>
                                        </div>
                                        <div className="card-body">
                                            <blockquote className="blockquote mb-0">

                                                <div>
                                                    <p><b>Status : </b>{stats?.currentStatus}</p>

                                                    {
                                                        stats?.completed ||
                                                        <>
                                                            <p>
                                                                <div className="row">
                                                                    <div className="col-4 col-md-2">
                                                                        <b>Process : </b>
                                                                    </div>
                                                                    <div className="col-8 col-md-4">
                                                                        <div className="progress" style={{ width: "70%" }}>
                                                                            <div className="progress-bar progress-bar-striped progress-bar-animated bg-success text-dark" role="progressbar"
                                                                                aria-valuemin="0"
                                                                                aria-valuenow={getPercentage(stats.downloadStatus?.fileDownloaded, stats.downloadStatus?.totalFileSize)}
                                                                                aria-valuemax="100"
                                                                                style={{ width: `${getPercentage(stats.downloadStatus?.fileDownloaded, stats.downloadStatus?.totalFileSize)}%` }}
                                                                            >
                                                                                <b>{getPercentage(stats.downloadStatus?.fileDownloaded, stats.downloadStatus?.totalFileSize)} % </b>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </p>
                                                            <p><b>Downloaded Size : </b>{bytesToReadbleFormat(stats.downloadStatus?.fileDownloaded)}</p>
                                                            <p><b>Remaining Size : </b>{bytesToReadbleFormat(stats.downloadStatus?.fileRemaining)}</p>
                                                            {/* {stats.downloadStatus?.speed && <p><b>Current Speed : </b>{bytesToReadbleFormat(stats.downloadStatus?.speed)}/s</p>} */}
                                                            {/* {stats.downloadStatus?.eta && <p><b>ETA : </b>{stats.downloadStatus?.eta}</p>} */}
                                                        </>

                                                    }

                                                    {stats.downloadStatus && stats.downloadStatus?.totalFileSize && <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadStatus?.totalFileSize)}</p>}
                                                    {stats.fileUrl && <p><b>Source Link : </b><a href={stats.fileUrl}>link</a></p>}
                                                </div>

                                                {/* {
                                                    

                                                    stats.isDownload &&
                                                    <div>
                                                        <p><b>Status : </b>{stats?.status}</p>
                                                        <p><b>Message : </b>{stats?.message}</p>
                                                        <p>
                                                            <div className="row">
                                                                <div className="col-4 col-md-2">
                                                                    <b>Process : </b>
                                                                </div>
                                                                <div className="col-8 col-md-4">
                                                                    <div className="progress" style={{ width: "70%" }}>
                                                                        <div className="progress-bar progress-bar-striped progress-bar-animated bg-success text-dark" role="progressbar"
                                                                            aria-valuemin="0"
                                                                            aria-valuenow={stats.downloadState.percentage ? parseFloat(stats.downloadState.percentage).toFixed(2) : getPercentage(stats.downloadState.downloadFileSize, stats.downloadState.totalFileSize)}
                                                                            aria-valuemax="100"
                                                                            style={{ width: stats.downloadState.percentage ? `${parseFloat(stats.downloadState.percentage).toFixed(2)}%` : `${getPercentage(stats.downloadState.downloadFileSize, stats.downloadState.totalFileSize)}%` }}
                                                                        >
                                                                            <b>{stats.downloadState.percentage ? parseFloat(stats.downloadState.percentage).toFixed(2) : getPercentage(stats.downloadState.downloadFileSize, stats.downloadState.totalFileSize)} % </b>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </p>
                                                        <p><b>Downloaded Size : </b>{bytesToReadbleFormat(stats.downloadState.downloadFileSize)}</p>
                                                        <p><b>Remaining Size : </b>{bytesToReadbleFormat(stats.downloadState.remaining)}</p>
                                                        {stats.downloadState.speed && <p><b>Current Speed : </b>{bytesToReadbleFormat(stats.downloadState.speed)}/s</p>}
                                                        {stats.downloadState.eta && <p><b>ETA : </b>{stats.downloadState.eta}</p>}
                                                        {stats.downloadState && stats.downloadState.totalFileSize && <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadState.totalFileSize)}</p>}
                                                        {stats.sourceUrl && <p><b>Source Link : </b><a href={stats.sourceUrl}>link</a></p>}
                                                    </div>
                                                }
                                                {
                                                    stats.isUpload &&
                                                    <div>
                                                        <p><b>Status : </b>{stats.status}</p>
                                                        {stats.uploadState && <p><b>Uploading State : </b>{stats.uploadState}</p>}
                                                        {stats.downloadState && stats.downloadState.totalFileSize ? <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadState.totalFileSize)}</p> : ""}
                                                        {stats.sourceUrl && <p><b>Source Link : </b><a href={stats.sourceUrl}>link</a></p>}
                                                    </div>
                                                }
                                                {
                                                    stats.isExtract &&
                                                    <div>
                                                        <p><b>Status : </b>{stats.status}</p>
                                                        <p><b>Extract Method : </b>{stats.extractMethod}</p>
                                                        <p><b>Message : </b>{stats.message}</p>
                                                        {stats.downloadState && stats.downloadState.totalFileSize ? <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadState.totalFileSize)}</p> : ""}
                                                        {stats.sourceUrl && <p><b>Source Link : </b><a href={stats.sourceUrl}>link</a></p>}
                                                    </div>
                                                }
                                                {
                                                    stats.isFailed &&
                                                    <div>
                                                        <p><b>Status : </b>{stats.status}</p>
                                                        <p><b>Message : </b>{stats.message}</p>
                                                        {stats.downloadState && stats.downloadState.totalFileSize ? <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadState.totalFileSize)}</p> : ""}
                                                        {stats.sourceUrl && <p><b>Source Link : </b><a href={stats.sourceUrl}>link</a></p>}
                                                    </div>
                                                }
                                                {
                                                    stats.isComplete &&
                                                    <div>
                                                        <p><b>Status : </b>{stats.status}</p>
                                                        {stats.downloadState && stats.downloadState.totalFileSize ? <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadState.totalFileSize)}</p> : ""}
                                                        {stats.isExtract && <p><b>Extract Method : </b>{stats.extractMethod}</p>}
                                                        {stats.sourceUrl && <p><b>Source Link : </b><a href={stats.sourceUrl}>link</a></p>}
                                                        <p><b>Drive Link : </b><a href={stats.driveLink}>link</a></p>
                                                        <p><b>Download Link : </b><a href={stats.downloadLink}>link</a></p>
                                                    </div>
                                                }
                                                {
                                                    (!stats.isDownload && !stats.isUpload && !stats.isExtract && !stats.isComplete && !stats.isFailed) ?
                                                        <div>
                                                            <p><b>Status : </b>{stats.status}</p>
                                                            <p><b>Message : </b>{stats.message}</p>
                                                            {stats.uploadState && <p><b>Uploading State : </b>{stats.uploadState}</p>}
                                                            {stats.downloadState && stats.downloadState.totalFileSize ? <p><b>Total Size : </b>{bytesToReadbleFormat(stats.downloadState.totalFileSize)}</p> : ""}
                                                            {stats.sourceUrl && <p><b>Source Link : </b><a href={stats.sourceUrl}>link</a></p>}
                                                        </div>
                                                        : ""
                                                } */}
                                            </blockquote>
                                        </div>
                                        <div className="card-footer">
                                            <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                                <button class="btn btn-warning me-md-2" type="button"
                                                onClick={()=>cancelleTask(stats.id)}
                                                >Cancelle Task 🚮</button>
                                                {/* <button class="btn btn-primary" type="button">Button</button> */}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                    }
                </div>
                ||
                <LoadingSpinner />
            }


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

export default Status;