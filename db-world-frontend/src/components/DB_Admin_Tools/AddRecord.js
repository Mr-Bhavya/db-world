import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Link } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Authentication from "../Authentication";
import Constants from "../Constants";
import CommonServices from "../CommonServices";
import { AddDbCinemaRecord } from "../ApiServices";

function AddRecord(props) {

    console.log(props)
    const userRole = props.userRole;
    const navigate = useNavigate();
    const TMDB_API_KEY = Constants.TMDB_API_KEY;
    const [selectMovie, setSelectMovie] = useState([]);
    const [tmdbLoader, setTmdbLoader] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [onSubmit, setOnSubmit] = useState(false);
    // const [userRole, SetUserRole] = useState();
    // const [loader, setLoader] = useState(true);
    const [inputFields, setInputFields] = useState({
        type: "",
        filmIndustry: "",
        name: "",
        year: "",
        quality: null,
        size: null,
        sizeFormat: null,
        downloadLink: null,
        tmdbData: ""
    })

    useEffect(() => {
        let authenticationRes = Authentication({ redirectTo: Constants.ADD_RECORD_ROUTE });
        if (!authenticationRes.login) {
            navigate(authenticationRes.redirectUrl, { replace: true });
        }else{
            if(userRole !== Constants.OWNER_USER_ROLE && userRole !== Constants.ADMIN_USER_ROLE){
                alert("don't have valid role");
            }
        }
    }, [])


    const onChangeHandler = (e) => {
        setInputFields({ ...inputFields, [e.target.name]: e.target.value })
        // e.target.name !== "name" && setOnSubmit(false)
    }

    const onTMDBIDChange = async (e) => {
        setTmdbLoader(true);
        if (inputFields.category === "Movie" || inputFields.category === "Series") {
            const res = await fetch(`https://api.themoviedb.org/3/${inputFields.category === "Movie" ? "movie" : "tv"}/${e.target.value}?api_key=${TMDB_API_KEY}&append_to_response=videos&language=en,hi,te,tm`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            })
            const data = await res.json();
            if (res.status === 200) {
                setInputFields({ ...inputFields, tmdbData: data, name: inputFields.category === "Movie" ? data.title : data.name })
            }
            else if (res.status === 401) {
                toast.error(data.errorMessage + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT(Constants.ADD_RECORED_REDIRECT));
                    },
                    autoClose: 1000
                })
            }
        } else {
            toast.warning("please Fill required field")
        }
        setTmdbLoader(false)
    }

    const getTMDBList = async () => {
        setTmdbLoader(true);
        setSelectMovie([]);
        var res = ""
        if (inputFields.type === "Movie" || inputFields.type === "Series") {
            let api = `https://api.themoviedb.org/3/search/` +
                `${inputFields.type === "Movie" ? "movie" : "tv"}` + "?api_key=" + TMDB_API_KEY +
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
            const { name, year, type, tmdbId } = inputFields;
            let addRecordRes = await AddDbCinemaRecord(name, type, tmdbId);
            console.log(addRecordRes)
            if (addRecordRes.httpStatusCode === 201) {
                toast.success("Record added, RecordId - " + addRecordRes.data.recordId);
            } else if (addRecordRes.httpStatusCode === 401) {
                toast.error(addRecordRes + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT(Constants.ADD_RECORD_ROUTE));
                    },
                    autoClose: 1000
                })
            } else {
                toast.error(addRecordRes.message);
            }
        } catch (err) {
            console.log(err);
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

            <h1 className="card-title text-center mx-3 my-2 border-bottom border-5 border-dark">
                ADD MOVIE
            </h1>
            <div className="row g-2 mx-2 my-1">
                <div className="col-md">
                    <div className="form-floating mb-2">
                        <select className="form-select" id="floatingSelect" onChange={onChangeHandler} name="type" value={inputFields.type} aria-label="Floating label select example">
                            <option value="" disabled={true}>Open this select menu</option>
                            <option value="Movie">Movie</option>
                            <option value="Series">Series</option>
                        </select>
                        <label htmlFor="floatingSelect">Choose Record Category</label>
                    </div>
                </div>
                {/* <div className="col-md">
                    <div className="form-floating mb-2">
                        <select className="form-select" id="floatingSelect" onChange={onChangeHandler} name="filmIndustry" value={inputFields.filmIndustry} aria-label="Floating label select example">
                            <option value="" disabled={true}>Open this select menu</option>
                            <option value="Bollywood">Bollywood</option>
                            <option value="Gujarati">Gujarati</option>
                            <option value="South">South</option>
                            <option value="Hollywood">Hollywood</option>
                        </select>
                        <label htmlFor="floatingSelect">Choose Film Industry</label>
                    </div>
                </div> */}
                <div className="col-md ">
                    <div className="form-floating mb-2">
                        <input type="text" className="form-control" id="floatingInput" onChange={onChangeHandler} name="name" value={inputFields.name} placeholder="Movie/Series Name" />
                        <label htmlFor="floatingInput">Record Name</label>
                    </div>
                </div>


            </div>
            <div className="row g-2 mx-2 my-1">

                <div className="col-md ">
                    <div className="form-floating mb-2">
                        <input type="number" className="form-control" id="floatingInput" onChange={onChangeHandler} name="year" value={inputFields.year} placeholder="Movie/Series Year" />
                        <label htmlFor="floatingInput">Year</label>
                    </div>
                </div>

            </div>
            <div className="row g-2 mx-2 my-1">

                {onSubmit &&
                    <div className="col-md">
                        <div className="form-floating mb-2">
                            <select className="form-select" id="floatingSelect" defaultValue="" onChange={onChangeHandler} name="tmdbId" aria-label="Floating label select example">
                                <option value="" disabled={false}>Open this select menu</option>
                                {
                                    selectMovie.map((ele, index) => {
                                        return <option value={ele.id}>
                                            {inputFields.type === "Movie" && ele.title || ele.name} &nbsp;| &nbsp;
                                            {inputFields.type === "Movie" && ele.release_date || ele.first_air_date}
                                        </option>
                                    })
                                }
                            </select>
                            <label htmlFor="floatingSelect">TMDB ID Select</label>
                        </div>
                    </div>
                }

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

export default AddRecord;