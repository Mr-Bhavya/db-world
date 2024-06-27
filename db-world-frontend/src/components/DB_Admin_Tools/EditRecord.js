import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLocation } from "react-router-dom";
import Authentication from "../Authentication";
import Constants from "../Constants";
import queryString from "query-string";
import { UpdateDbCinemaRecord, getUserRole } from "../ApiServices";

function EditRecord() {

    const addMovieStyle = {
        margin: "2% 10% 2% 10%",
        border: "2px solid",
        background: "rgba(255 ,255 ,255, 0.9)",
        padding: "2%",
    }
    const navigate = useNavigate();
    const location = useLocation();
    const TMDB_API_KEY = "30061af77dba3722bbe14a2691055544"
    const [selectMovie, setSelectMovie] = useState([]);
    const [tmdbLoader, setTmdbLoader] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [onSubmit, setOnSubmit] = useState(false);
    const [loader, setLoader] = useState(true);
    const [inputFields, setInputFields] = useState({})
    const [userRole, SetUserRole] = useState();

    const checkUserRole = async (userId) => {

        let roleRes = await getUserRole(userId);
        if (roleRes.httpStatusCode === 200) {
            SetUserRole(roleRes.data.role.name);
            if (roleRes.data.role.name !== Constants.OWNER_USER_ROLE && roleRes.data.role.name !== Constants.ADMIN_USER_ROLE) {
                alert("You don't have admin rights.")
                navigate(Constants.DB_WORLD_HOME_ROUTE);
            } else {
                if (location.state && location.state !== null) {
                    setInputFields(location.state)
                    setLoader(false);
                } else {
                    if (location.search && location.search.length > 0) {
                        let query = queryString.parse(location.search);
                        if (query && query._id) {
                            getRecord(query._id);
                        }
                    }
                    toast.warning("problem to fetch details");
                    navigate(Constants.REDIRECT(Constants.DB_MOVIES_ROUTE));
                }
            }
        } else if (roleRes.httpStatusCode === 401) {
            navigate(Constants.LOGIN_ROUTE, { replace: true });
        }

        // let response = await CommonServices.userRole(_id);
        // if (response.statusCode === 200) {
        //     SetUserRole(response.userRole);
        //     if (response.userRole !== Constants.OWNER_USER_ROLE && response.userRole !== Constants.ADMIN_USER_ROLE) {
        //         alert("You don't have admin rights.")
        //         navigate(Constants.DB_WORLD_HOME_ROUTE);
        //     } else {
        //         if (location.state && location.state !== null) {
        //             setInputFields(location.state)
        //             setLoader(false);
        //         } else {
        //             if (location.search && location.search.length > 0) {
        //                 let query = queryString.parse(location.search);
        //                 if (query && query._id) {
        //                     getRecord(query._id);
        //                 }
        //             }
        //             toast.warning("problem to fetch details");
        //             navigate(Constants.REDIRECT(Constants.DB_MOVIES_ROUTE));
        //         }
        //     }
        // }
        // else if (response.statusCode === 401) {
        //     navigate(Constants.REDIRECT(Constants.DB_MOVIES_ROUTE), { replace: true });
        // }
        // else {
        //     alert("unable to fetch user role, viewing page as normal user :)")
        //     navigate(Constants.DB_WORLD_HOME_ROUTE)
        // }
    }

    useEffect(() => {
        let authenticationRes = Authentication();
        if (authenticationRes.login) {
            checkUserRole(authenticationRes.user.userId)
        }
        else {
            navigate(authenticationRes.redirectUrl, { replace: true });
        }
    }, [])

    //TODO
    async function getRecord(_id) {
        // get record from database
    }


    const onChangeHandler = (e) => {
        if (e.target.name === 'showOnTop') {
            console.log(e.target.name, !inputFields.showOnTop)
            setInputFields({ ...inputFields, [e.target.name]: !inputFields.showOnTop })
        } else
            setInputFields({ ...inputFields, [e.target.name]: e.target.value })
        // setOnSubmit(false)
    }

    const onTMDBIDChange = async (e) => {
        // setInputFields({ ...inputFields, [e.target.name]: e.target.value })
        // console.log(e.target.value);
        setTmdbLoader(true);
        if (inputFields.type === "Movie" || inputFields.type === "Series") {
            const res = await fetch(`https://api.themoviedb.org/3/${inputFields.type === "Movie" ? "movie" : "tv"}/${e.target.value}?api_key=${TMDB_API_KEY}&append_to_response=videos&language=en,hi,te,tm`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            })
            const data = await res.json();
            if (res.status === 200) {
                setInputFields({ ...inputFields, tmdbData: data, name: inputFields.type === "Movie" ? data.title : data.name })
            }
        } else {
            toast.warning("please Fill required field")
        }
        setTmdbLoader(false)
    }

    const getTMDBList = async () => {
        setTmdbLoader(true);
        setSelectMovie([]);
        console.log(inputFields)
        var res = ""
        if (inputFields.type.toLocaleLowerCase() === ("Movie").toLocaleLowerCase() || inputFields.type.toLocaleLowerCase() === ("Series").toLocaleLowerCase()) {
            let api = `https://api.themoviedb.org/3/search/` +
                `${inputFields.type.toLocaleLowerCase() === ("Movie").toLocaleLowerCase() ? "movie" : "tv"}` + "?api_key=" + TMDB_API_KEY +
                "&query=" + inputFields.name + `${inputFields.year ? "&year=" + inputFields.year : ""}`;
            res = await fetch(api,
                {
                    method: "GET",
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    }
                })
        }
        else {
            toast.warning("please select movie catagory first.")
        }
        if (res.status === 200) {
            const data = await res.json();
            setOnSubmit(true);
            if (res.status === 200) {
                setSelectMovie(data.results);
            }
            else {
                toast.warning("please fill movie name");
                setOnSubmit(false);
            }
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
                                    value={inputFields.type} aria-label="Floating label select example" disabled>
                                    <option value="" disabled={true}>Open this select menu</option>
                                    <option value="Movie">Movie</option>
                                    <option value="Series">Series</option>
                                </select>
                                <label htmlFor="floatingSelect">Choose type</label>
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
                                        <select className="form-select" id="floatingSelect" name="tmdbId" defaultValue="" onChange={onChangeHandler} aria-label="Floating label select example">
                                            <option value="" disabled={true}>Open this select menu</option>
                                            {
                                                selectMovie.map(ele => {
                                                    return <option value={ele.id}>
                                                        {inputFields.type.toLocaleLowerCase() === ("Movie").toLocaleLowerCase() && ele.title || ele.name} &nbsp;| &nbsp;
                                                        {inputFields.type.toLocaleLowerCase() === ("Movie").toLocaleLowerCase() && ele.release_date || ele.first_air_date}
                                                    </option>
                                                })
                                            }
                                        </select>
                                        <label htmlFor="floatingSelect">TMDB ID Select</label>
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