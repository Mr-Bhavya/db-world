import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Navigate, useNavigate } from "react-router";
import { Link } from "react-router-dom"
import { reloadMovies } from "../../redux/action/allActions"
import Constants from "../Constants";
import LoadingSpinner from "../LoadingSpinner";
import LikeIcon from "./SubComponents/LikeIcon";
import WatchlistIcon from "./SubComponents/WatchlistIcon";
import { deleteDbCinemaRecord, loadStreamFileInfoByRecordId } from "../ApiServices";
import { toast } from "react-toastify";
import { Button, Card, Col, Collapse, Container, Modal, Row } from "react-bootstrap";
import WatchedIcon from "./SubComponents/WatchedIcon";
import HtmlJsonTable from "react-json-to-html-table";
import CommonServices from "../CommonServices";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

function SingleMovie(props) {
    const movie = props.movie;
    movie["tmdbData"] = movie?.type == Constants.RECORD_TYPE_MOVIE ? movie?.movieTmdb : movie?.seriesTmdb;
    const userData = props.userData;
    const userRole = props.userRole;
    const id = props.id;
    const [deleteRecord, setDeleteRecord] = useState();
    const [setTrailer, setSetTrailer] = useState(false);
    const [loader, setLoader] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [mediaFileList, setMediaFileList] = useState([]);
    const [showMediaInfo, setShowMediaInfo] = useState(false);
    const [mediaListLoader, setMediaListLoader] = useState(false);
    var deleteModelTargetSrc = "#deleteMovieId" + movie.recordId;
    var deleteModelTargetDes = "deleteMovieId" + movie.recordId;
    var trailerModelTargetDes = "trailerMovieId" + new Date();
    var trailerModelTargetSrc = "#" + trailerModelTargetDes;
    const navigate = useNavigate();
    const dispatch = useDispatch();
    let count = 0;

    const newlyAdded = (recodAddedTimeStamp) => {

        let newlyAdded = false;

        let recordDate = new Date();
        recordDate.setTime(recodAddedTimeStamp)

        let currentDate = new Date();
        let timeDifference = Math.abs(currentDate - recordDate);

        const daysDiffence = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)) - 1;

        if (daysDiffence <= 4) {
            newlyAdded = true; // 3days diffence
        }
        return newlyAdded;
    }

    if (movie.tmdbData) {

        trailerModelTargetSrc = "#trailerMovieId" + movie.tmdbData.id;
        trailerModelTargetDes = "trailerMovieId" + movie.tmdbData.id;

        var ratting = null
        if (movie.tmdbData.vote_average / 2 >= 0 && movie.tmdbData.vote_average / 2 < 0.5) {
            ratting = <img style={{ width: "1.5rem" }} src="https://img.icons8.com/?size=100&id=tj8r6ld19VuU&format=png&color=000000"></img>
        }
        else if (movie.tmdbData.vote_average / 2 >= 0.5 && movie.tmdbData.vote_average / 2 <= 1.5) {
            ratting = "⭐"
        }
        else if (movie.tmdbData.vote_average / 2 >= 1.5 && movie.tmdbData.vote_average / 2 <= 2.5) {
            ratting = "⭐⭐"
        }
        else if (movie.tmdbData.vote_average / 2 >= 2.5 && movie.tmdbData.vote_average / 2 <= 3.5) {
            ratting = "⭐⭐⭐"
        }
        else if (movie.tmdbData.vote_average / 2 >= 3.5 && movie.tmdbData.vote_average / 2 <= 4.5) {
            ratting = "⭐⭐⭐⭐"
        }
        else if (movie.tmdbData.vote_average / 2 >= 4.5 && movie.tmdbData.vote_average / 2 <= 5) {
            ratting = "⭐⭐⭐⭐⭐"
        }

        var ytTrailerLink = ""
        if (movie.tmdbData.videos.length > 0) {
            if (movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "hi").length >= 1) {
                ytTrailerLink = movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "hi")
            } else if (movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "en").length >= 1) {
                ytTrailerLink = movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "en")
            } else if (movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "te").length >= 1) {
                ytTrailerLink = movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "te")
            } else if (movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "ta").length >= 1) {
                ytTrailerLink = movie.tmdbData.videos.filter(ele => ele.iso_639_1 === "ta")
            } else {
                ytTrailerLink = movie.tmdbData.videos[0];
            }

            if (ytTrailerLink) {
                if (ytTrailerLink.filter(ele => ele.type === "Trailer").length === 0) {
                    if (ytTrailerLink.filter(ele => ele.type === "Teaser").length === 0) {
                        ytTrailerLink = `https://www.youtube.com/embed/${ytTrailerLink[0].key}`
                    } else {
                        ytTrailerLink = `https://www.youtube.com/embed/${ytTrailerLink.filter(ele => ele.type === "Teaser")[0].key}`
                    }
                } else {
                    ytTrailerLink = `https://www.youtube.com/embed/${ytTrailerLink.filter(ele => ele.type === "Trailer")[0].key}`
                }
            }
        }


        var release_date = ""
        if (movie.tmdbData.release_date) {
            release_date = movie.tmdbData.release_date.split("-");
            release_date.reverse();
            release_date = release_date.join("/");
        }
        else if (movie.tmdbData.first_air_date) {
            release_date = movie.tmdbData.first_air_date.split("-");
            release_date.reverse();
            release_date = release_date.join("/");
        }
        movie.tmdbData.release_date = release_date;
    }

    async function onDelete() {
        try {
            let deleteRes = await deleteDbCinemaRecord(movie.recordId)
            if (deleteRes.httpStatusCode === 200) {
                // alert("Deleted Successfully.")
                dispatch(reloadMovies());
                toast.error(deleteRes.message)
            } else if (deleteRes.httpStatusCode === 401) {
                alert(deleteRes.message + Constants.RE_LOGIN)
                navigate(await Constants.REDIRECT());
            }
            else {
                toast.error(deleteRes.message);
            }
        } catch (err) {
            console.log(err);
            alert(err);
        }
    }

    const trailer =
        <>
            <iframe
                src={ytTrailerLink}
                width="100%"
                height="220rem"
                allowFullScreen={true}
            ></iframe>
        </>

    const handleDownloadModal = async () => {
        setShowDownloadModal(true);
        setMediaListLoader(true);
        const response = await loadStreamFileInfoByRecordId(movie.recordId);
        if (response.httpStatusCode === 200) {
            setMediaFileList(CommonServices.convertMediaInfoToCustomFormat(response.data));
            setMediaListLoader(false);
        }

    }

    const handleDownload = async (mediaFile) => {
        let tempUrl = window.location.origin + "/api/stream/watch/" + mediaFile.id + "?t=" + localStorage.getItem("token");
        if (window.location.port === "3000") {
            tempUrl = tempUrl.replace("3000", "9000")
        }
        let videoUrl = tempUrl;
        tempUrl = tempUrl.replace("/watch", "/download/uuid")
        let downloadUrl = tempUrl
        if (Capacitor.isNativePlatform()) {
            Browser.open(downloadUrl)
        } else {
            window.open(downloadUrl);
        }
    }

    const dowanloadModal =
        <Modal show={showDownloadModal} onHide={() => setShowDownloadModal(false)} fullscreen={true}>
            <Modal.Header closeButton>
                <Modal.Title>Media List</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {
                    mediaListLoader ? <LoadingSpinner />
                        : mediaFileList?.length == 0
                            ?
                            <div className="d-flex justify-content-center align-items-center vh-100">
                                <div className="alert alert-danger text-center" role="alert">
                                    No media available to download for this record
                                </div>
                            </div>
                            : mediaFileList.map((mediaFile, index) => {
                                return (<Card className="my-3">
                                    <Card.Header as="h5">{index + 1}. {mediaFile?.general?.fileName}</Card.Header>
                                    <Card.Body>
                                        <Card.Text>

                                            <Button
                                                size="sm"
                                                className="btn-sm btn-light btn-outline-dark mx-auto"
                                                onClick={(e) => setShowMediaInfo(showMediaInfo !== "media-info-" + index ? "media-info-" + index : "false")}
                                                aria-controls={"media-info-" + index}
                                                aria-expanded={showMediaInfo === "media-info-" + index ? true : false}
                                            >
                                                Show Media Info {showMediaInfo === "media-info-" + index ? "🔻" : "▶️"}
                                            </Button>
                                            <Collapse in={showMediaInfo === "media-info-" + index ? true : false}>
                                                <div id={"media-info-" + index} style={{ overflow: "auto" }}>
                                                    <HtmlJsonTable data={mediaFile} className="table table-sm table-striped table-bordered table-responsive-sm" HeaderText="Media Info" />
                                                </div>
                                            </Collapse>

                                        </Card.Text>
                                    </Card.Body>
                                    <Card.Footer>
                                        <Button className="btn-sm float-end" variant="danger" onClick={() => handleDownload(mediaFile)}>Download</Button>
                                    </Card.Footer>
                                </Card>)
                            })
                }

            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowDownloadModal(false)}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>

    let singleMovie = ""
    if (movie.tmdbData) {
        singleMovie =
            <Card className="m-1"
                style={{ background: "rgba(255 ,255 ,255, 0.6)", maxHeight: "22rem" }}
            // style={{ background: "rgba(255 ,255 ,255, 0.6)" }} 
            // style={{ background: "rgba(255 ,255 ,255, 0.6)" }}
            >
                {movie.tmdbData.backdrop_path && <div >
                    <img src={`https://image.tmdb.org/t/p/w500${movie.tmdbData.backdrop_path}`} alt={movie.name}
                        style={{ height: "100%", width: "100%", position: "absolute", zIndex: "-1" }}
                    />
                </div> || ""}
                <Card.Header>
                    <div className="mx-1">
                        <div className="row">

                            {/* Movie Name */}
                            <div className="col mt-2">
                                <h6 className="table-responsive mb-0">
                                    {movie.name}
                                </h6>
                            </div>

                            {
                                userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?

                                    /* Movie Delete Button */
                                    < div className="col-2">
                                        <button type="button" className="btn btn-danger btn-sm" data-bs-toggle="modal" data-bs-target={deleteModelTargetSrc} onClick={() => setDeleteRecord({ recordId: movie.recordId, name: movie.name, type: movie.type })}>🗑</button>
                                    </div> : ""
                            }

                            {
                                userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?

                                    /* Movie Edit Button */
                                    <div className="col-2 ">
                                        <Link type="button" className="btn btn-success btn-sm"
                                            to={Constants.EDIT_RECORD_ROUTE.replace(":title", movie.recordId + "-" + movie.name.toLowerCase().replaceAll(/ /g, "-"))}
                                            state={movie}
                                        >📝</Link>
                                    </div> : ""
                            }

                            {
                                newlyAdded(movie.recordId) ? <div>
                                    <span className="position-absolute top-0 end-0 translate-middle-y badge rounded-pill bg-primary">
                                        New
                                        <span className="visually-hidden">newly added</span>
                                    </span>
                                </div> : ""
                            }
                        </div>

                        {/* Delete Movie Model */}
                        <div className="modal fade" id={deleteModelTargetDes} tabIndex="-1" aria-labelledby={deleteModelTargetDes} aria-hidden="true">
                            <div className="modal-dialog">
                                <div className="modal-content">
                                    <div className="modal-header">
                                        <h5 className="modal-title" id={deleteModelTargetDes}>Conform Delete ?</h5>
                                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div className="modal-body">
                                        <b>You want to delete this record?</b>
                                        <br />
                                        Record Id: {movie?.recordId}<br />
                                        Record Name: {movie?.name}<br />
                                        Record Type: {movie?.type}
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
                    </div>
                </Card.Header>
                <Card.Body style={{ overflowY: "auto" }}>
                    {/* <Container> */}
                    <Row className="justify-content-md-start">
                        {/* Movie Image */}
                        <Col xs={5}
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(
                                movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
                                    ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(":title", movie.recordId + "-" + movie.name.toLowerCase().replace(/ /g, "-"))
                                    : Constants.DB_SERIES_DETIALS_ROUTE.replace(":title", movie.recordId + "-" + movie.name.toLowerCase().replace(/ /g, "-"))
                            )}
                        >
                            <img src={`https://image.tmdb.org/t/p/w500${movie.tmdbData.poster_path}`} alt={movie.name}
                                style={{ maxHeight: "12rem", maxWidth: "10rem", width: "100%", height: "auto" }}
                            />
                            <div>
                                <div className="btn btn-secondary-dark btn-sm border-top border-dark w-100 m-0 p-0" style={{ display: "inline-block", maxWidth: "10rem" }}
                                    onClick={() => navigate(
                                        movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
                                            ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(":title", movie.recordId + "-" + movie.name.toLowerCase().replace(/ /g, "-"))
                                            : Constants.DB_SERIES_DETIALS_ROUTE.replace(":title", movie.recordId + "-" + movie.name.toLowerCase().replace(/ /g, "-"))
                                    )}
                                >

                                    <img
                                        className="mx-1"
                                        src="https://img.icons8.com/ios-filled/50/000000/info.png"
                                        style={{ width: "1rem" }}
                                        title="Click for more details" alt="Click for more details"
                                    />
                                    More info ..
                                </div>
                            </div>

                        </Col>
                        <Col xs={7}>
                            {/* Movie Details */}
                            {/* <div className="d-grid gap-0 d-md-flex-row ms-3"> */}
                            <p className="m-0 p-0"><b>Release: </b>
                                {movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE ? movie.tmdbData.release_date : movie.tmdbData.first_air_date}
                            </p>
                            {
                                movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE ?
                                    <p className="m-0 p-0"><b>Runtime: </b> {Math.floor(movie.tmdbData.runtime / 60) + "h " + movie.tmdbData.runtime % 60 + "m"} </p>
                                    :
                                    <p className="m-0 p-0"><b>No. Of Seasons: </b>{movie.tmdbData.number_of_seasons}</p>
                            }
                            <p className="m-0 p-0"> <b>Geners: </b>
                                {
                                    movie.tmdbData.genres.map(ele => {
                                        count++;
                                        if (count === movie.tmdbData.genres.length) {
                                            let genres = ele.name
                                            return genres
                                        }
                                        else {
                                            let genres = ele.name + ", "
                                            return genres
                                        }
                                    })
                                }
                            </p>
                            {ratting != null ? <p className="m-0 p-0 card-text"><b style={{ fontWeight: "bold" }}>Ratting: </b> {ratting}</p> : ""}
                            <div className="">

                                <LikeIcon
                                    isLiked={movie?.isLiked}
                                    recordId={movie.recordId} userId={userData.userId}
                                />

                                <WatchlistIcon
                                    isAddedToWatchList={movie?.isWatchListed}
                                    recordId={movie.recordId} userId={userData.userId}
                                />

                                {/* <button className='btn btn-sm' onClick={() => navigate((movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE) + `?id=${movie.recordId}`)}>
                                        <img src="https://img.icons8.com/ios-filled/50/000000/info.png"
                                            style={{ width: "2rem" }}
                                            title="Click for more details" alt="Click for more details"
                                        />
                                        <br />
                                        <span style={{ fontSize: "0.8rem" }}>Info</span>
                                    </button> */}

                            </div>
                            <div>
                                <span>
                                    <WatchedIcon
                                        isWatched={movie?.isWatched}
                                        recordId={movie.recordId} userId={userData.userId}
                                    />
                                    <img type="button" src="https://img.icons8.com/color/48/000000/youtube-play.png"
                                        style={{ width: "2.5rem" }}
                                        data-bs-toggle="modal"
                                        data-bs-target={trailerModelTargetSrc}
                                        data-placement="top" title="Watch Trailer On Youtube"
                                        onClick={() => setSetTrailer(true)}
                                    />
                                    {/* {movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE && <a href={`https://www.imdb.com/title/${movie.tmdbData.imdb_id}`} target="_blank" >
                                        <img type="button" src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg"
                                            style={{ width: "2.5rem" }}
                                            data-placement="top" title="IMDB Link"
                                        />
                                    </a>} */}
                                    {movie.tmdbData.adult && <img type="button" src="https://img.icons8.com/color/48/000000/18-plus.png" />}
                                    {/* <img type="button" title="Click for more details" alt="more details"
                                            onClick={() => navigate((movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE) + `?id=${movie.recordId}`)}
                                            style={{ width: "35px" }} src="https://img.icons8.com/ios-filled/50/000000/info.png" /> */}

                                </span>
                            </div>


                            {/* </div> */}

                            {/* youtube trailer modal */}
                            <div className="modal fade" id={trailerModelTargetDes} tabIndex="-1" aria-labelledby={trailerModelTargetDes} aria-hidden="true">
                                {loader && <LoadingSpinner /> || <div className="modal-dialog">
                                    {!ytTrailerLink && <div className="modal-content">
                                        <div className="modal-header">
                                            <h5 className="modal-title" id="trailerModelTargetDes">{movie.name}</h5>
                                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={
                                                () => setSetTrailer(false)
                                            }></button>
                                        </div>
                                        <div className="modal-body">
                                            <div className="alert alert-warning text-center">
                                                <b className="border-bottom">⚠ No Trailer or Video Found For This Movie. ⚠</b></div>
                                        </div>
                                        <div className="modal-footer">
                                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                        </div>
                                    </div> ||
                                        <div className="modal-content">
                                            <div className="modal-header">
                                                <h5 className="modal-title" id="trailerModelTargetDes">{movie.name}</h5>
                                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={
                                                    () => setSetTrailer(false)
                                                }></button>
                                            </div>
                                            <div className="modal-body">
                                                {
                                                    setTrailer && trailer
                                                }
                                            </div>
                                            <div className="modal-footer">
                                                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={() => setSetTrailer(false)}>Close</button>
                                            </div>
                                        </div>
                                    }
                                </div>}
                            </div>
                        </Col>
                    </Row>
                    {/* </Container> */}
                </Card.Body>
                <Card.Footer style={{ height: "2rem" }} className="m-0 p-0">
                    <Button className="btn-sm m-0 p-0 w-100 h-90" variant="dark" onClick={handleDownloadModal}>Download</Button>
                </Card.Footer>
                {dowanloadModal}
                {/* <hr /> */}
            </Card >
    }

    else {
        singleMovie =
            <div className="col d-flex align-items-stretch my-3" >

                {/* Movie Home Card */}
                <div className="card w-100 my-1" style={{ background: "rgba(255 ,255 ,255, 0.6)", height: "22rem", }}>
                    <div className="d-flex align-items-stretch" >

                        <div className="container mx-1">
                            <div className="row">

                                {/* Movie Name */}
                                <div className="col mt-2">
                                    <h6 className="table-responsive mb-0">
                                        {movie.name}
                                    </h6>
                                </div>

                                {
                                    userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?

                                        /* Movie Delete Button */
                                        < div className="col-2">
                                            <button type="button" className="btn btn-danger btn-sm" data-bs-toggle="modal" data-bs-target={deleteModelTargetSrc} onClick={() => setDeleteRecord({ recordId: movie.recordId, name: movie.name, type: movie.type })}>🗑</button>
                                        </div> : ""
                                }

                                {
                                    userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?

                                        /* Movie Edit Button */
                                        <div className="col-2 ">
                                            <Link type="button" className="btn btn-success btn-sm"
                                                to={Constants.EDIT_RECORD_ROUTE + "?_id=" + movie.recordId}
                                                state={movie}
                                            >📝</Link>
                                        </div> : ""
                                }
                            </div>
                        </div>
                    </div>
                </div>
                {Constants.TOAST_CONTAINER}
            </div>

    }

    return (
        singleMovie
        // <div className="" style={{ marginTop: "1%" }}>

        // </div>
    )
}

export default SingleMovie;