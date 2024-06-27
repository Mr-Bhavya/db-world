import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, } from 'react-toastify';
import Constants from '../Constants';

function Clone() {

    const [link, setLink] = useState("");
    const [title, setTitle] = useState("");
    const [extract, setExtract] = useState(false);
    const [zipPassword, setZipPassword] = useState("");
    const [zipPasswordProtect, setZipPasswordProtect] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [rename, setRename] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async () => {
        // setListening(false);
        setSubmitLoader(true);
        try {
            const res = await fetch("/api/media/clone", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    url: link,
                    isExtract: extract,
                    isRename: rename,
                    title
                })
            })
            const data = await res.json();
            console.log(data);
            if (res.status === 200) {
                toast.success(data.result);
            } else if (res.status === 401) {
                toast.error(data.errorMessages + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=download"));
                    },
                    autoClose: 1000
                })
            } else {
                toast.error(data.errorMessages || data.error);
            }
            setSubmitLoader(false);
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
            <h1 className="card-title text-center mx-3 my-2 border-bottom border-5 border-dark"> CLONE / GDTOT </h1>
            <div className="row g-2 mx-2 my-1">
                <div className="col-md">
                    <div className="form-floating mb-2">
                        <input type="search"
                            className="form-control"
                            id="floatingInput"
                            name="downloadLink"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="Enter Drive Link" />
                        <label htmlFor="floatingInput">Download Link</label>
                    </div>
                </div>

                <div>
                    <h5 className='mx-3'>Do you want to extract file ?</h5>
                    <div className="form-check mx-5">
                        <input className="form-check-input"
                            type="radio"
                            name="extract"
                            id="extract"
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
                    <div className="col-md">
                        <div className="form-floating">
                            {
                                !submitLoader &&
                                <button type="submit"
                                    className="btn btn-primary mx-3 my-1"
                                    onClick={onSubmit}
                                >Submit</button>
                                ||
                                <button className="btn btn-primary mx-1" type="button" disabled>
                                    Processing ...
                                </button>
                            }
                        </div>
                    </div>
                </div>

                <hr />


            </div>
            {Constants.TOAST_CONTAINER}
        </div >
    )

}

export default Clone;