import React, { useState } from "react";
import { useNavigate } from "react-router";
import Constants from "../Constants";
import LikeIcon from "./SubComponents/LikeIcon";
import WatchlistIcon from "./SubComponents/WatchlistIcon";
import { Button, ButtonGroup, Card, Col, Row } from "react-bootstrap";
import WatchedIcon from "./SubComponents/WatchedIcon";
import DownloadModal from "./SingleRecordSubComponent/DownloadModal";
import DeleteModal from "./SingleRecordSubComponent/DeleteModal";
import YoutubeTrailerModal from "./SingleRecordSubComponent/YoutureTrailerModal";

function SingleMovie(props) {
    const movie = props.movie;
    movie["tmdbData"] = movie?.type == Constants.RECORD_TYPE_MOVIE ? movie?.movieTmdb : movie?.seriesTmdb;
    const userData = props.userData;
    const userRole = props.userRole;
    const idx = props?.idx+1;
    const [loader, setLoader] = useState(false);
    const navigate = useNavigate();
    let count = 0;

    const convertVoteAverageToRatting = (voteAverage) => {
        let ratting = <img style={{ width: "1.5rem" }} src="https://img.icons8.com/?size=100&id=tj8r6ld19VuU&format=png&color=000000"></img>
        if (voteAverage / 2 >= 0 && voteAverage / 2 < 0.5) {
            ratting = <img style={{ width: "1.5rem" }} src="https://img.icons8.com/?size=100&id=tj8r6ld19VuU&format=png&color=000000"></img>
        }
        else if (voteAverage / 2 >= 0.5 && voteAverage / 2 <= 1.5) {
            ratting = "⭐"
        }
        else if (voteAverage / 2 >= 1.5 && voteAverage / 2 <= 2.5) {
            ratting = "⭐⭐"
        }
        else if (voteAverage / 2 >= 2.5 && voteAverage / 2 <= 3.5) {
            ratting = "⭐⭐⭐"
        }
        else if (voteAverage / 2 >= 3.5 && voteAverage / 2 <= 4.5) {
            ratting = "⭐⭐⭐⭐"
        }
        else if (voteAverage / 2 >= 4.5 && voteAverage / 2 <= 5) {
            ratting = "⭐⭐⭐⭐⭐"
        }
        return ratting;
    }

    const convertToHumanRedableDate = (date) => {
        return date?.split("-")?.reverse()?.join("/");
    }

    return (
        <Card className="m-1"
            style={{ background: "rgba(255 ,255 ,255, 0.5)", maxHeight: "22rem" }}
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
                        <div className="col-10">
                            <h6 className="table-responsive mb-0">
                                {movie.name}
                            </h6>
                        </div>

                        {
                            userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?
                                <ButtonGroup aria-label="edit-delete" className="col-2 m-0 p-0">
                                    <Button variant="primary" className="col-1 m-0 p-0" aria-label="edit"
                                        onClick={() => navigate(Constants.EDIT_RECORD_ROUTE.replace(":title", movie.recordId + "-" + movie.name.toLowerCase().replaceAll(/ /g, "-")), { state: movie })}>
                                        📝
                                    </Button>
                                    <Button variant="danger" className="col-1 m-0 p-0" aria-label="delete">
                                        <DeleteModal movie={movie} userRole={userRole} />
                                    </Button>
                                </ButtonGroup>
                                : ""
                        }

                        {
                            idx && idx < 12 ? <div>
                                <span className="position-absolute top-0 end-0 translate-middle-y badge rounded-pill bg-success">
                                    New
                                    <span className="visually-hidden">newly added</span>
                                </span>
                            </div> : ""
                        }
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
                        <p className="m-0 p-0"><b>Release: </b>
                            {convertToHumanRedableDate(movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE ? movie.tmdbData.release_date : movie.tmdbData.first_air_date)}
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
                        <p className="m-0 p-0 card-text"><b style={{ fontWeight: "bold" }}>Ratting: </b> {convertVoteAverageToRatting(movie?.tmdbData?.vote_average)}</p>
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
                                <YoutubeTrailerModal movie={movie} userRole={userRole} />

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
                    </Col>
                </Row>
            </Card.Body>
            <Card.Footer style={{ height: "2rem" }} className="m-0 p-0">
                <div className="float-end">
                    <DownloadModal movie={movie} userRole={userRole} />
                </div>
            </Card.Footer>
        </Card >
    )
}

export default SingleMovie;