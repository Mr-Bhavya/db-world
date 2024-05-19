import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom';
import { searchInDriveQuery, searchList } from '../../../redux/action/allActions'
import Authentication from '../../Authentication';
import Constants from '../../Constants';
import CommonServices from '../../CommonServices';

function SearchInDrive( props) {

    const dispatch = useDispatch();
    const query = useSelector(state => state.searchInDriveReducer);
    const searchFileList = useSelector(state => state.searchListReducer.fileList);
    const searchFolderList = useSelector(state => state.searchListReducer.folderList);
    const [searchMovieList, setSearchMovieList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [noResultMessage, setNoResultMessage] = useState("");
    const [userData, setUserData] = useState({});
    const [userRole, SetUserRole] = useState(props.userRole);
    const navigate = useNavigate();
    const [driveId, setDriveId] = useState("")
    const [copyId, setCopyId] = useState("")
    const [getIndexLinkLoader, setGetIndexLinkLoader] = useState(false);
    const [copySuccess, setCopySuccess] = useState({
        className: "btn btn-primary btn-sm",
        lable: "Copy Link "
    })
    const [deleteDriveId, setDeleteDriveId] = useState("")
    var deleteModelTargetSrc = "#deleteMovieId" + deleteDriveId;
    var deleteModelTargetDes = "deleteMovieId" + deleteDriveId;

    useEffect(() => {
        let authenticationRes = Authentication();
        if (authenticationRes.login) {
            setUserData(authenticationRes.user);
        }
    }, [])

    const searchMovie = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`/api/media/drive/search?q=${query}`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                credentials: "include"
            })

            const data = await res.json();
            if (res.status === 200) {
                dispatch(searchList(data));
            }
            else if (res.status === 401) {
                alert(data.errorMessage + Constants.RE_LOGIN);
                navigate(await Constants.REDIRECT());
            }
            else {
                dispatch(searchList(data));
            }
            setLoading(false)
        }
        catch (e) {
            setLoading(false)
        }
    }

    const getIndexLink = async (file) => {
        setGetIndexLinkLoader(true);
        try {
            const res = await fetch(`/api/media/index?driveId=${file.id}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    credentials: "include"
                }
            )
            const data = await res.json();
            if (res.status === 200) {

                if (file.mimeType === "application/vnd.google-apps.folder") {
                    searchFolderList.map(folderList => {
                        if (folderList.id === file.id) {
                            folderList.indexLink = data.url;
                        }
                    })
                }
                else {
                    searchFileList.map(fileList => {
                        if (fileList.id === file.id) {
                            fileList.indexLink = data.url;
                        }
                    })
                }

                dispatch(searchList({ fileList: searchFileList, folderList: searchFolderList }))
            }
            else {

            }
        }
        catch (e) {
            console.log(e);
        }
        setGetIndexLinkLoader(false);
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

    const onCopy = (indexLink) => {
        navigator.clipboard.writeText(indexLink);
        setCopySuccess({
            className: "btn btn-success btn-sm",
            lable: "Copied !"
        })
        setInterval(() => {
            setCopySuccess({
                className: "btn btn-primary btn-sm",
                lable: "Copy Link "
            })
        }, 5000)
    }

    const onDelete = async () => {
        try {
            const res = await fetch(`/api/media/drive/delete?driveId=${deleteDriveId}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    credentials: "include"
                }
            )
            const data = await res.json();
            if (res.status === 200) {
                alert("deleted successfully done.")
            }
            else {
                alert("not able to delete");
            }
        }
        catch (e) {
            console.log(e);
        }
    }


    if (searchFileList.length > 0) {
        var displayFileList = <ul className="list-group">
            {
                searchFileList.map((file, key) => {
                    key = file.id
                    return (
                        <li className="list-group-item list-group-item-action flex-column align-items-start my-1">
                            <b className='d-flex flex-wrap' style={{ overflowX: 'auto' }}> <span> 📄 {file.name} || <b className='text-danger'>{bytesToReadbleFormat(file.size)} </b> || From Index: {file.indexHost.split("/")[3].split(":")[0]}</span></b>
                            <hr />
                            <div className='text-center'>
                                {
                                    getIndexLinkLoader && key == driveId ?
                                        <button className="btn btn-dark mx-1" type="button" disabled>
                                            Loading ...
                                        </button>
                                        :
                                        file.indexLink ?
                                            <span>
                                                <a type="button" className="btn btn-success btn-sm mx-1 my-1"
                                                    href={file.indexLink}
                                                    target="_blank"
                                                >
                                                    <b>Download</b>
                                                </a>
                                                <button className={key === copyId ? copySuccess.className : 'btn btn-primary btn-sm'} onClick={() => {
                                                    onCopy(file.indexLink)
                                                    setCopyId(file.id)
                                                }
                                                }
                                                >
                                                    {key === copyId ? copySuccess.lable : 'Copy Link'}
                                                </button>
                                            </span>
                                            :
                                            <button type="button" className="btn btn-warning btn-sm mx-1 my-1"
                                                onClick={() => {
                                                    setDriveId(file.id)
                                                    getIndexLink(file)
                                                }}
                                            >
                                                <b>Get Download Link</b>
                                            </button>
                                }

                                {
                                    userRole === Constants.OWNER_USER_ROLE || userRole === Constants.ADMIN_USER_ROLE ?
                                        <>
                                            <a type="button" className="btn btn-dark btn-sm mx-1 my-1" href={file.driveLink} target="_blank">
                                                <b>Drive</b>
                                            </a>

                                            <button type="button"
                                                className="btn btn-danger btn-sm"
                                                data-bs-toggle="modal"
                                                data-bs-target={deleteModelTargetSrc}
                                                onClick={() => setDeleteDriveId(file.id)}
                                            >Delete</button>
                                        </>
                                        : ""
                                }
                            </div>
                        </li>
                    )
                })
            }

            {/* Delete Movie Model */}
            <div className="modal" id={deleteModelTargetDes} tabIndex="-1" aria-labelledby={deleteModelTargetDes} aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id={deleteModelTargetDes}>Conform Delete ?</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            You want to delete this movie?
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" className="btn btn-danger" data-bs-dismiss="modal" onClick={() => onDelete()} >
                                Yes, Delete it!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ul>
    }
    else {
        var displayFileList = ""
    }

    if (searchFolderList.length > 0) {
        var displayFolderList = <ul className="list-group">
            {
                searchFolderList.map((file, key) => {
                    key = file.id
                    return (
                        <li className="list-group-item list-group-item-action flex-column align-items-start my-1">
                            <b className='d-flex flex-wrap' style={{ overflowX: 'auto' }}> 📁 {file.name}  || From Index: {file.indexHost.split("/")[3].split(":")[0]} </b>
                            <hr />
                            <div className='text-center'>
                                {
                                    getIndexLinkLoader && key == driveId ?
                                        <button className="btn btn-dark mx-1" type="button" disabled>
                                            Loading ...
                                        </button>
                                        :
                                        file.indexLink ?
                                            <span>
                                                <a type="button" className="btn btn-success btn-sm mx-1 my-1"
                                                    href={file.indexLink}
                                                    target="_blank"
                                                >
                                                    <b>Download Link</b>
                                                </a>
                                                <button className={key === copyId ? copySuccess.className : 'btn btn-primary btn-sm'} onClick={() => {
                                                    onCopy(file.indexLink)
                                                    setCopyId(file.id)
                                                }
                                                }
                                                >
                                                    {key === copyId ? copySuccess.lable : 'Copy Link'}
                                                </button>
                                            </span>
                                            :
                                            <button type="button" className="btn btn-warning btn-sm mx-1 my-1"
                                                onClick={() => {
                                                    setDriveId(file.id)
                                                    getIndexLink(file)
                                                }}
                                            >
                                                <b>Get Download Link</b>
                                            </button>
                                }

                                {
                                    userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?
                                        <>
                                            <a type="button" className="btn btn-dark btn-sm mx-1 my-1" href={file.driveLink} target="_blank">
                                                <b>Drive</b>
                                            </a>

                                            <button type="button"
                                                className="btn btn-danger btn-sm"
                                                data-bs-toggle="modal"
                                                data-bs-target={deleteModelTargetSrc}
                                                onClick={() => setDeleteDriveId(file.id)}
                                            >Delete</button>
                                        </>
                                        : ""
                                }

                            </div>
                        </li>
                    )
                })
            }
        </ul>
    }
    else {
        var displayFolderList = ""
    }

    return (
        <div className="bg-transparent pb-5">
            <h4 style={{ textAlign: "center", border: "2px solid", padding: "1%", background: "rgba(255 ,255 ,255, 0.9)", marginBottom: "3%" }}>Search In Drive</h4>
            <div className="m-3">
                {/* {search} */}

                <p className="text-danger"><b>*Note:</b> This search option will take 10 to 15 Seconds to get results.</p>

                <form className="form-inline col-12 justify-content-end d-flex" onSubmit={searchMovie}>
                    <input
                        className="form-control"
                        type="search"
                        placeholder="Search"
                        aria-label="Search"
                        value={query}
                        onChange={(e) =>
                            dispatch(searchInDriveQuery(e.target.value))
                        }
                    />
                    {
                        !loading ?
                            <button type="button"
                                className="btn btn-outline-success mx-1"
                                onClick={searchMovie}
                            >Search</button>
                            :
                            <button className="btn btn-success mx-1" type="button" disabled>
                                Searching...
                            </button>

                    }

                </form>


            </div>
            {
                !loading ?
                    <div className='m-3'>
                        {
                            searchFileList.length === 0 && searchFolderList.length === 0 ?
                                <div className='text-center mx-3 my-5'>
                                    <h4 classname="text-danger">
                                        No results found for your query. 😞
                                    </h4>
                                </div>
                                : ""
                        }

                        {
                            displayFolderList &&
                            <div>
                                <h3 className='text-center'>
                                    Folder List
                                </h3>
                                {displayFolderList}

                            </div>
                        }
                        {
                            displayFileList &&
                            <div>
                                <h3 className='text-center'>
                                    File List
                                </h3>
                                {displayFileList}

                            </div>
                        }

                    </div>
                    :
                    <div className="d-flex justify-content-center">
                        <div className="spinner-border text-danger m-5" role="status">
                            <span className="sr-only"></span>
                        </div>
                    </div>
            }
        </div>
    )
}

export default SearchInDrive;