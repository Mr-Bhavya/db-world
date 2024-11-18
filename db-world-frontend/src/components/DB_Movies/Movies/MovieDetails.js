import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LoadingSpinner from "../../LoadingSpinner";
import Constants from "../../Constants";
import { getRecordDetailsbyId } from "../../ApiServices";
import Providers from "../SubComponents/Providers";
import Credits from "../SubComponents/Credits";
import LikeIcon from "../SubComponents/LikeIcon";
import WatchlistIcon from "../SubComponents/WatchlistIcon";

function MovieDetails() {

    let user = JSON.parse(localStorage.getItem("user"))

    const parseQuery = (search) => {
        search = search.split("?")[1].split("&");
        let queryParam = {};
        search = search.map((query) => {
            let key = query.split("=")[0];
            let value = query.split("=")[1];
            queryParam[key] = value;
        })
        return queryParam;
    }

    const navigate = useNavigate();
    const location = useLocation();
    const { id, watch } = parseQuery(location.search);
    const [movieData, setMovieData] = useState("");
    const [loader, setLoader] = useState(true);
    const [cast, setCast] = useState([]);
    const [crew, setCrew] = useState([]);
    const [provider, setProvider] = useState({
        "buy": [],
        "rent": [],
        "flatrate": []
    });
    var count = 0;

    const getMovie = async () => {

        let recordResponse = await getRecordDetailsbyId(id);
        if (recordResponse.httpStatusCode === 200) {
            let movie = recordResponse.data;
            movie["tmdbData"] = movie?.type == Constants.RECORD_TYPE_MOVIE ? movie?.movieTmdb : movie?.seriesTmdb;
            if (movie === "No results found") {
                navigate(Constants.DB_WORLD_HOME_ROUTE);
            }
            else {
                setProvider({
                    "buy": movie?.tmdbData?.providers?.buy || null,
                    "rent": movie?.tmdbData?.providers?.rent || null,
                    "flatrate": movie.tmdbData?.providers?.flatrate || null
                });
                setCast(movie.tmdbData.credits.cast);
                setCrew(movie.tmdbData?.credits?.crew);
                setMovieData(movie);
            }
            setLoader(false);
        }
        else if (recordResponse.httpStatusCode === 401) {
            navigate(await Constants.REDIRECT(Constants.DB_MOVIE_DETIALS_ROUTE + "?id=" + id), { replace: true });
        }
        else {
            console.log(recordResponse.message);
            navigate(Constants.DB_WORLD_HOME_ROUTE);
        }
    }

    useEffect(() => {
        getMovie()
    }, []);



    if (movieData.tmdbData) {

        var release_date = ""
        if (movieData.tmdbData.release_date) {
            release_date = movieData.tmdbData.release_date.split("-");
            release_date.reverse();
            release_date = release_date.join("/");
        }

    }

    return (
        loader ? <LoadingSpinner />
            :
            <div className="mx-auto" style={{ background: "rgba(255 ,255 ,255, 0.9)", maxWidth: "1000px", border: "2px Soild white" }}>
                {watch && <>
                    <button type="button"
                        className="btn-close"
                        style={{
                            backgroundColor: "white",
                            position: "absolute",
                            top: "5rem",
                            right: "5px",
                            zIndex: "1030"
                        }}
                        onClick={() => navigate(-1)}
                    />
                    <>
                        <video className="video-fluid ms-3 mt-3 mb-3"
                            autoPlay={true}
                            loop controls muted
                            id="cspd_video"
                            poster={movieData.tmdbData.backdrop_path}
                            style={{ width: "90%" }}
                        >
                            <source src={movieData.downloadLink} />
                        </video>
                    </>

                    {/* <VideoPlayer url={movieData.downloadLink} /> */}
                </>
                    ||
                    <div className="" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
                        <div>
                            <a
                                className="mx-3 my-3"
                                style={{
                                    position: "fixed",
                                    bottom: "5px",
                                    right: "5px",
                                    zIndex: "1030"
                                }}
                                href={movieData.downloadLink}
                            >
                                <img
                                    // className="btn btn-danger btn-sm"
                                    // style={{ borderRadius: "50%", width:"80%" }}
                                    src="https://img.icons8.com/external-soft-fill-juicy-fish/60/000000/external-download-essentials-soft-fill-soft-fill-juicy-fish.png" />
                            </a>
                        </div>


                        <div className="card bg-dark text-white" style={{
                            background: "rgba(0,0,0,0.5)",
                        }}>
                            <img
                                src={movieData.tmdbData.backdrop_path && `https://image.tmdb.org/t/p/original${movieData.tmdbData.backdrop_path}` || `https://wallpapercave.com/dwp1x/wp3377140.jpg`}
                                className="card-img"
                                style={{
                                    // height:"15rem"
                                    height: "auto"
                                }}
                                alt={movieData.name} />
                            <div className="card-img-overlay my-auto"
                                style={{
                                    background: "rgba(0,0,0,0.7)",
                                }}>
                                <img
                                    src={`https://image.tmdb.org/t/p/w500${movieData.tmdbData.poster_path}`}
                                    className="img-fluid"
                                    alt={movieData.name}
                                    style={{
                                        width: "30%",
                                        boxShadow: "2px 2px 20px 10px black",
                                    }} />
                                <div className="my-auto"
                                    style={{
                                        top: "10%",
                                        left: "35%",
                                        position: "absolute",
                                        // position: "absolute",
                                        // width:"100%"
                                    }}>
                                    <h5 className="card-title mx-3"><b>{movieData.name} ({movieData.tmdbData.release_date.split("-")[0]})</b></h5>
                                    <div className="card-text mx-3">
                                        {release_date && <span>{release_date} </span>}
                                        {movieData.tmdbData.runtime && <span><span> | </span>{Math.floor(movieData.tmdbData.runtime / 60)}h {movieData.tmdbData.runtime % 60}m </span> || ""}
                                        <br />
                                        {/* <span> | </span> */}
                                        <span>
                                            {
                                                movieData.tmdbData.genres.map(ele => {
                                                    count++;
                                                    if (count === movieData.tmdbData.genres.length) {
                                                        let genres = ele.name
                                                        return genres
                                                    }
                                                    else {
                                                        let genres = ele.name + ", "
                                                        return genres
                                                    }
                                                })
                                            }
                                        </span>
                                        <br />
                                        <div>
                                            {
                                                movieData.tmdbData.tagline
                                                && <p className="my-3"><q>{movieData.tmdbData.tagline}</q></p>
                                                || <p type="text-center" className="text-center mt-3">
                                                    <b className="progress w-100" style={{ border: "2px solid" }}>
                                                        <span className="progress-bar progress-bar-striped bg-warning" role="progressbar" style={{ width: `${movieData.tmdbData.vote_average * 10}%` }} aria-valuenow={movieData.tmdbData.vote_average * 10} aria-valuemin="0" aria-valuemax="100">{movieData.tmdbData.vote_average * 10}%</span>
                                                    </b>
                                                    <span>Ratting from <b>{movieData.tmdbData.vote_count}</b> users</span>
                                                </p>
                                            }
                                        </div>



                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                }


                <div className="card-body text-center">
                    <h1 className="card-title">
                        {movieData.name} ({movieData.tmdbData.release_date.split("-")[0]})
                        &nbsp;
                        <a className="mx-3" href={`https://www.imdb.com/title/${movieData.tmdbData.imdb_id}`} target="_blank" >
                            <button className=" btn btn-sm btn-warning"><b>IMDB</b></button>
                        </a>
                    </h1>

                    <div className="row g-0 m-3 d-flex justify-content-center">
                        <div className="" style={{ width: "6rem" }} >
                            <b className="progress" style={{ border: "2px solid", width: "6rem" }}>
                                <span className="progress-bar progress-bar-striped bg-warning" role="progressbar"
                                    style={{ width: `${parseInt(movieData.tmdbData.vote_average * 10)}%` }}
                                    aria-valuenow={parseInt(movieData.tmdbData.vote_average * 10)}
                                    aria-valuemin="0"
                                    aria-valuemax="100">{parseInt(movieData.tmdbData.vote_average * 10)}%</span>
                            </b>
                            <span>Ratting from <br /><b>{movieData.tmdbData.vote_count}</b> users</span>
                        </div>

                        <div style={{width:"150px"}}>
                            <LikeIcon recordId={movieData.recordId} userId={user.userId} isLiked={movieData.isLiked} />
                            <WatchlistIcon recordId={movieData.recordId} userId={user.userId} isAddedToWatchList={movieData.isWatchListed} />
                        </div>
                    </div>

                </div>

                <Providers title={movieData.name} provider={provider} />

                <div className="m-3">
                    <details>
                        <summary >
                            <b style={{ fontWeight: "bold" }}>Storyline: </b>
                        </summary>
                    </details>
                    <p className="mx-3">{movieData.tmdbData.overview}</p>
                </div>
                <Credits cast={cast} crew={crew} />
                {
                    movieData.tmdbData.videos.length !== 0
                    &&
                    <div className="border-dark mx-3 my-3" style={{ height: "13rem" }}>
                        <div>
                            <h5>
                                <details>
                                    <summary>
                                        Trailer/Teaser
                                    </summary>
                                </details>
                            </h5>
                            <ul className="nav nav-pills" style={{ overflowX: "auto" }}>
                                <table className="mx-3 my-1">
                                    <thead>
                                        <tr>
                                            {
                                                movieData.tmdbData.videos.map(video => {
                                                    return <td className="">
                                                        <iframe
                                                            src={`https://www.youtube.com/embed/${video.key}`}
                                                            className=""
                                                            // style={{ width: "100%" }}
                                                            allowFullScreen={true}
                                                        >
                                                        </iframe>
                                                    </td>
                                                })
                                            }
                                        </tr>
                                    </thead>
                                </table>
                            </ul>
                        </div>
                    </div>
                }

                <div className="row mx-1 my-5">
                    <div className="col-5" style={{ height: "12.5rem", overflowY: "auto", border: "1px Solid" }}>
                        <p className="mt-2"><b>Status: </b> {movieData.tmdbData.status}</p>
                        <p><b>Original Language: </b> {movieData.tmdbData.original_language}</p>
                        <p><b>Budget: </b>{movieData.tmdbData.budget !== 0 ? <>{movieData.tmdbData.budget.toLocaleString()} $</> : "-"}</p>
                        <p><b>Revenue: </b>{movieData.tmdbData.revenue !== 0 ? <>{movieData.tmdbData.revenue.toLocaleString()} $</> : "-"}</p>
                    </div>

                    <div className="col-7" style={{ height: "12.5rem", overflowY: "auto", border: "1px Solid" }}>
                        <p className="text-center mt-2"><b>Production Companies</b></p>
                        <hr />
                        <div style={{ listStyle: "none" }}>
                            {
                                movieData.tmdbData.production_companies.map(ele => {
                                    return <li className="mx-0">
                                        <details>
                                            <summary>
                                                <b>{ele.name}</b>
                                            </summary>
                                            {
                                                ele.logo_path && <img
                                                    className="card-img-top mx-3"
                                                    src={`https://image.tmdb.org/t/p/w200${ele.logo_path}`}
                                                    alt={ele.name}
                                                    style={{ borderRadius: "5%", width: "5rem" }} />
                                            }
                                        </details>
                                    </li>
                                })
                            }
                        </div>
                    </div>
                </div>
                <br />
            </div >



    )

}

export default MovieDetails;