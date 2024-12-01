import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLocation } from "react-router-dom";
import Constants from "../Constants";
import queryString from "query-string";
import { UpdateDbCinemaRecord, getUserRole, searchTmdbByQuery } from "../ApiServices";

function EditRecord() {

    const navigate = useNavigate();
    const location = useLocation();
    const [selectRecord, setSelectRecord] = useState([]);
    const [tmdbLoader, setTmdbLoader] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [onSubmit, setOnSubmit] = useState(false);
    const [loader, setLoader] = useState(true);
    const [inputFields, setInputFields] = useState({})
    const [userRole, SetUserRole] = useState();

    // const checkUserRole = async (userId) => {

    //     let roleRes = await getUserRole(userId);
    //     if (roleRes.httpStatusCode === 200) {
    //         SetUserRole(roleRes.data.role.name);
    //         if (roleRes.data.role.name !== Constants.OWNER_USER_ROLE && roleRes.data.role.name !== Constants.ADMIN_USER_ROLE) {
    //             alert("You don't have admin rights.")
    //             navigate(Constants.DB_WORLD_HOME_ROUTE);
    //         } else {
    //             if (location.state && location.state !== null) {
    //                 setInputFields(location.state)
    //                 setLoader(false);
    //             } else {
    //                 if (location.search && location.search.length > 0) {
    //                     let query = queryString.parse(location.search);
    //                     if (query && query._id) {
    //                         getRecord(query._id);
    //                     }
    //                 }
    //                 toast.warning("problem to fetch details");
    //                 navigate(Constants.REDIRECT(Constants.DB_MOVIES_ROUTE));
    //             }
    //         }
    //     } else if (roleRes.httpStatusCode === 401) {
    //         navigate(Constants.LOGIN_ROUTE, { replace: true });
    //     }
    // }

    useEffect(() => {
        console.log(location);
        if (location.state && location.state !== null) {
            setInputFields(location.state)
            setLoader(false);
        } else {
            toast.warning("problem to fetch details");
            navigate(Constants.DB_MOVIES_ROUTE);
        }
    }, [])


    const onChangeHandler = (e) => {
        console.log(e.target.name, e.target.value);
        if (e.target.name === 'showOnTop') {
            console.log(e.target.name, !inputFields.showOnTop)
            setInputFields({ ...inputFields, [e.target.name]: !inputFields.showOnTop })
        } else {
            setInputFields({ ...inputFields, [e.target.name]: e.target.value })
            if (e.target.name != "tmdbId") {
                setSelectRecord(null)
                setOnSubmit(false);
            }
        }
    }

    const getTMDBList = async () => {
        setTmdbLoader(true);
        setSelectRecord([]);
        if (inputFields.type.toLocaleLowerCase() === "movie" || inputFields.type.toLocaleLowerCase() === "series") {
            console.log(inputFields);
            let seachTmdbRes = await searchTmdbByQuery(inputFields.type.toLocaleLowerCase(), inputFields.name, inputFields.year);
            if (seachTmdbRes.httpStatusCode === 200) {
                setSelectRecord(seachTmdbRes.data);
                setOnSubmit(true);
            } else if (seachTmdbRes.httpStatusCode === 401) {
                navigate(await Constants.REDIRECT(Constants.ADD_RECORD_ROUTE))
            } else {
                toast.error(seachTmdbRes.message);
            }
        } else {
            toast.warning("please select record type first.")
        }
        setTmdbLoader(false);
    }


    const onSubmitHandle = async (e) => {
        setSubmitLoader(true)
        try {

            const { recordId, type, name, tmdbId, showOnTop } = inputFields;
            let updateRecordRes = await UpdateDbCinemaRecord(recordId, { type, name, tmdbId, showOnTop });
            if (updateRecordRes.httpStatusCode === 200) {
                toast.success("Record edited Sucesssfully.", {
                    onClose: () => navigate(Constants.DB_MOVIES_ROUTE),
                    autoClose: 1000
                });
                setSubmitLoader(false);
            } else if (updateRecordRes.httpStatusCode === 401) {
                toast.error(updateRecordRes.message + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT());
                    },
                    autoClose: 1000
                })
            }
            else {
                toast.error(updateRecordRes.message)
                setSubmitLoader(false);
            }
        } catch (err) {
            console.log(err);
            toast.error("Failed to edit record.")
        }
        setSubmitLoader(false);
    }

    return (
        <div className="card mx-3 my-3"
            style={{
                border: "2px solid",
                background: "rgba(255 ,255 ,255, 0.9)",
            }}
        >
            <h1 className="card-title text-center mx-5 my-2 border-bottom border-5 border-dark"> UPDATE RECORD </h1>
            {
                loader
                &&
                <div className="col-md-8">
                    <div className='d-flex justify-content-center'>
                        <div className="spinner-border text-danger m-5 p-5" role="status">
                            <span className="sr-only text-center" />
                        </div>
                    </div>
                </div>
                ||
                <div>
                    <div className="row g-2 mx-2 my-1">
                        <div className="col-md">
                            <div className="form-floating mb-2">
                                <select className="form-select" id="floatingSelect" defaultValue="" onChange={onChangeHandler} name="type"
                                    value={inputFields.type.toLocaleLowerCase()} aria-label="Floating label select example" disabled>
                                    <option value="" disabled={true}>Open this select menu</option>
                                    <option value="movie">Movie</option>
                                    <option value="series">Series</option>
                                </select>
                                <label htmlFor="floatingSelect">Choose Record type</label>
                            </div>
                        </div>
                        <div className="col-md ">
                            <div className="form-floating mb-2">
                                <input type="text" className="form-control" id="name" onChange={onChangeHandler} name="name" value={inputFields.name} placeholder="Movie/Series Name" />
                                <label htmlFor="floatingInput">Record Name</label>
                            </div>
                        </div>
                    </div>
                    <div className="row g-2 mx-2 my-1">
                        <div className="col-md ">
                            <div className="form-floating mb-2">
                                <input type="number" className="form-control" id="year" onChange={onChangeHandler} name="year" value={inputFields.year} placeholder="Movie/Series Year" />
                                <label htmlFor="floatingInput">Year</label>
                            </div>
                        </div>
                        <div className="form-check form-switch m-1">
                            <input type="checkbox" className="form-check-input" id="showOnTop" role="switch" onChange={onChangeHandler} name="showOnTop"
                                value={inputFields.showOnTop}
                                checked={inputFields.showOnTop} />
                            <label class="form-check-label" htmlFor="showOnTop">Show On Top</label>
                        </div>
                    </div>
                    <div className="row g-2 mx-2 my-1">
                        <div>
                            {onSubmit &&
                                <div className="col-md">
                                    <div className="form-floating mb-2">
                                        <select className="form-select" id="tmdbId" name="tmdbId" defaultValue="" onChange={onChangeHandler} aria-label="Floating label select example">
                                            <option value="" disabled={true}>Open this select menu</option>
                                            {
                                                selectRecord?.map(ele => {
                                                    return <option value={ele.id}>
                                                        {ele.title} &nbsp; | &nbsp; {ele.originalTitle} &nbsp; | &nbsp; {ele.releaseDate}
                                                    </option>
                                                })
                                            }
                                        </select>
                                        <label htmlFor="tmdbId">TMDB ID Select</label>
                                    </div>
                                </div>
                            }
                        </div>
                    </div>
                    <div className="row g-2 mx-3 my-2" >
                        <div className="col-md">
                            {!tmdbLoader ?
                                !submitLoader ?
                                    <button type="button" className="btn btn-primary"
                                        onClick={getTMDBList}>
                                        Get TMDB List
                                    </button> : ""
                                : <button type="button" className="btn btn-primary mx-3 my-1" disabled>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    &nbsp;&nbsp;&nbsp;&nbsp; Getting TMDB List ...
                                </button>}

                            {onSubmit && <>
                                {!submitLoader ?
                                    !tmdbLoader ?
                                        <button type="submit" className="btn btn-primary mx-3 my-1" onClick={onSubmitHandle}>Submit</button> : ""
                                    :
                                    <button className="btn btn-primary mx-3 my-1" type="button" disabled >
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        &nbsp;&nbsp;&nbsp;&nbsp; Adding To Database ...
                                    </button>
                                }</>
                            }

                            {!tmdbLoader && !submitLoader ?
                                <button type="button" className="btn btn-outline-danger mx-5 my-2"
                                    onClick={() => navigate(-1)}>
                                    ❌ Cancel
                                </button> : ""
                            }
                        </div>

                    </div>
                </div>
            }
            {Constants.TOAST_CONTAINER}
        </div >
    )

}

export default EditRecord;