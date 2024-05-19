import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import Constants from '../Constants';
import { mirror } from '../ApiServices';

function Mirror() {

    const [link, setLink] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [linkPasswordProtect, setLinkPasswordProtect] = useState(false);
    const [title, setTitle] = useState("");
    const [extract, setExtract] = useState(false);
    const [zipPassword, setZipPassword] = useState("");
    const [zipPasswordProtect, setZipPasswordProtect] = useState(false);
    const [rename, setRename] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async () => {
        // setListening(false);
        try {
            if (!link.includes("gdtot") && !link.includes("drive.google.com")) {
                setSubmitLoader(true);

                const mirrorRes = await mirror({
                    url:link,
                    username,
                    password,
                    fileName:title,
                    isRename:rename,
                    isUrlProtected:linkPasswordProtect,
                    isExtract:extract,
                    extractPassword:zipPassword
                });
                if (mirrorRes.httpStatusCode === 200) {
                    toast.success(mirrorRes.message);
                } else if (mirrorRes.httpStatusCode === 401) {
                    toast.error(mirrorRes.message + Constants.RE_LOGIN, {
                        onClose: async () => {
                            navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=download"));
                        },
                        autoClose: 1000
                    })
                }
                else {
                    toast.error(mirrorRes.message);
                }

                // const res = await fetch(Constants.MIRROR_API, {
                //     method: "POST",
                //     headers: {
                //         Accept: "application/json",
                //         "Content-Type": "application/json",
                //     },
                //     credentials: "include",
                //     body: JSON.stringify({
                //         url: link,
                //         linkPasswordProtect,
                //         zipPasswordProtect,
                //         extract,
                //         username,
                //         password,
                //         zipPassword,
                //         rename,
                //         title
                //     })
                // })
                // // console.log(res);
                // const data = await res.json();
                // console.log(data);
                // if (res.status === 200) {
                //     toast.success(data.result);
                // }
                // else if (res.status === 401) {
                //     toast.error(data.errorMessage + Constants.RE_LOGIN, {
                //         onClose: async () => {
                //             navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=download"));
                //         },
                //         autoClose: 1000
                //     })
                // } else {
                //     toast.error(data.errorMessage || data.error);
                // }
                setSubmitLoader(false);
            }
            else {
                toast.error("This is not clone.")
            }
        } catch (err) {
            console.log(err);
            setSubmitLoader(false);
            toast.error("Failed.")
        }
    }


    return (
        <div className="card mx-3 my-3"
            style={{
                border: "2px solid",
                background: "rgba(255 ,255 ,255, 0.9)",
            }}
        >
            <h1 className="card-title text-center mx-3 my-2 border-bottom border-5 border-dark"> Mirror </h1>
            <div className="row g-2 mx-2 my-1">
                <div className="col-md">
                    <div className="form-floating mb-2">
                        <input type="search"
                            className="form-control"
                            id="floatingInput"
                            name="downloadLink"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="Enter Download Link" />
                        <label htmlFor="floatingInput">Download Link</label>
                    </div>
                </div>
                <div className="form-check mx-3">
                    <input className="form-check-input"
                        type="checkbox"
                        value={linkPasswordProtect}
                        id="linkPasswordProtect"
                        checked={linkPasswordProtect}
                        onChange={() => {
                            setLinkPasswordProtect(!linkPasswordProtect)
                        }
                        } />
                    <label className="form-check-label" htmlFor="linkPasswordProtect">
                        <h5>link is password protected</h5>
                    </label>
                    {
                        linkPasswordProtect ?
                            <div>
                                <div className="col-md mx-3">
                                    <div className="form-floating mb-2">
                                        <input type="search"
                                            className="form-control"
                                            id="floatingInput"
                                            name="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Username" />
                                        <label htmlFor="floatingInput">Username</label>
                                    </div>
                                </div>
                                <div className="col-md mx-3">
                                    <div className="form-floating mb-2">
                                        <input type="search"
                                            className="form-control"
                                            id="floatingInput"
                                            name="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="password" />
                                        <label htmlFor="floatingInput">password</label>
                                    </div>
                                </div>
                            </div>
                            :
                            ""
                    }
                </div>

                <div className='col-md'>
                    <input className="form-check-input mx-3"
                        type="checkbox"
                        value={rename}
                        id="rename"
                        checked={rename}
                        onChange={() => {
                            setRename(!rename)
                        }
                        } />
                    <label className="form-check-label" htmlFor="rename">
                        <h5>Rename File</h5>
                    </label>

                    {
                        rename &&
                        <div className="col-md mx-3">
                            <div className="form-floating mb-2">
                                <input type="search"
                                    className="form-control"
                                    id="floatingInput"
                                    name="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Rename file" />
                                <label htmlFor="floatingInput">File Name</label>
                            </div>
                        </div>
                    }

                </div>

                <div>
                    <h5 className='mx-3'>Do you want to extract file ?</h5>
                    <div className="form-check mx-5">
                        <input className="form-check-input"
                            type="radio"
                            name="extract"
                            id={extract}
                            defaultChecked={extract}
                            value={true}
                            onChange={() => {
                                setExtract(true);
                                console.log(extract);
                            }}
                        />
                        <label className="form-check-label" htmlFor="extract">
                            yes
                        </label>
                    </div>

                    <div className="form-check mx-5">
                        <input className="form-check-input"
                            type="radio"
                            name="extract"
                            // id={extract}
                            // defaultChecked={!extract}
                            // value={false}
                            onChange={() => {
                                setExtract(false);
                                console.log(extract);
                            }}
                        />
                        <label className="form-check-label" htmlFor="extract">
                            No
                        </label>
                    </div>
                </div>

                <div>
                    {
                        extract &&
                        <div className="form-check mx-5">
                            <input className="form-check-input"
                                type="checkbox"
                                value={zipPasswordProtect}
                                id="zipPasswordProtect"
                                checked={zipPasswordProtect}
                                onChange={() => {
                                    setZipPasswordProtect(!zipPasswordProtect)
                                }
                                } />
                            <label className="form-check-label" htmlFor="zipPasswordProtect">
                                <h5>file is password protected</h5>
                            </label>
                            {
                                zipPasswordProtect ?
                                    <div>
                                        <div className="col-md">
                                            <div className="form-floating mb-2">
                                                <input type="search"
                                                    className="form-control"
                                                    id="floatingInput"
                                                    name="zipPassword"
                                                    value={zipPassword}
                                                    onChange={(e) => setZipPassword(e.target.value)}
                                                    placeholder="Zip Password" />
                                                <label htmlFor="floatingInput">password</label>
                                            </div>
                                        </div>
                                    </div>
                                    :
                                    ""
                            }
                        </div>

                    }
                </div>

                {
                    !submitLoader &&
                    <div>
                        <div className="col-md">
                            <div className="form-floating">
                                <button type="submit"
                                    className="btn btn-primary mx-3 my-1"
                                    onClick={onSubmit}
                                >Submit</button>
                            </div>
                        </div>
                    </div>
                    ||
                    <div>
                        <div className="col-md">
                            <div className="form-floating">
                                <button className="btn btn-primary" type="button" disabled>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    &nbsp;&nbsp;&nbsp;Processing ...
                                </button>
                            </div>
                        </div>
                    </div>
                }
                <hr />
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
        </div >
    )

}

export default Mirror;