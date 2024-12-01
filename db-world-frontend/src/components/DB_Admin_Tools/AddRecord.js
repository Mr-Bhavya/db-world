import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Constants from "../Constants";
import { AddDbCinemaRecord, searchTmdbByQuery } from "../ApiServices";

function AddRecord(props) {

    const userRole = props.userRole;
    const navigate = useNavigate();
    const [selectRecord, setSelectRecord] = useState([]);
    const [tmdbLoader, setTmdbLoader] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [onSubmit, setOnSubmit] = useState(false);
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

    const onChangeHandler = (e) => {
        setInputFields({ ...inputFields, [e.target.name]: e.target.value })
        if (e.target.name != "tmdbId") {
            setSelectRecord(null)
            setOnSubmit(false);
        }
    }

    const getTMDBList = async () => {
        setTmdbLoader(true);
        setSelectRecord([]);
        if (inputFields.type === "Movie" || inputFields.type === "Series") {
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
            toast.warning("please select movie catagory first.")
        }
        setTmdbLoader(false);
    }


    const onSubmitHandle = async (e) => {
        setSubmitLoader(true)
        try {
            const { name, year, type, tmdbId } = inputFields;
            let addRecordRes = await AddDbCinemaRecord(name, type, tmdbId);
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
        <div className="card my-1"
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
                            <select className="form-select" id="tmdbId" defaultValue="" onChange={onChangeHandler} name="tmdbId" aria-label="Floating label select example">
                                <option value="" disabled={false}>Open this select menu</option>
                                {
                                    selectRecord?.map((ele, index) => {
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
            {Constants.TOAST_CONTAINER}
        </div >
    )

}

export default AddRecord;