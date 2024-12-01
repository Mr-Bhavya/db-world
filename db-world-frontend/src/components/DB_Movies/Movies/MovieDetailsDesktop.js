import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Constants from "../../Constants";
import LoadingSpinner from "../../LoadingSpinner";
import { getRecordDetailsbyId } from "../../ApiServices";
import Providers from "../SubComponents/Providers";
import Credits from "../SubComponents/Credits";
import LikeIcon from "../SubComponents/LikeIcon";
import WatchlistIcon from "../SubComponents/WatchlistIcon";

function MovieDetailsDesktop(props) {
    let user = JSON.parse(localStorage.getItem("user"))

    const navigate = useNavigate();
    const location = useLocation();
    const id = location?.pathname?.split("/")?.pop()?.split("-")[0];
    const [watch, setWatch] = useState(null);
    const [movieData, setMovieData] = useState("");
    const [loader, setLoader] = useState(true);
    const [cast, setCast] = useState([]);
    const [crew, setCrew] = useState([]);
    const [provider, setProvider] = useState({
        "buy": [],
        "rent": [],
        "flatrate": []
    });
    const [watchProvider, setWatchProviser] = useState(false);
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
                    "flatrate": movie?.tmdbData?.providers?.flatrate || null
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
        if (id) {
            getMovie()
        }
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
            <div>
                <div className="card text-white mx-5" style={{
                    backgroundImage: `url("https://image.tmdb.org/t/p/original${movieData.tmdbData.backdrop_path}")`,
                    height: "550px",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 100%",
                    backgroundAttachment: "relative"
                }}>

                    {
                        watch &&
                        <div style={{
                            background: "rgba(255,255,255,0.9)"
                        }}>
                            <button type="button" className="btn-close btn-close-white" aria-label="Close"
                                style={{
                                    backgroundColor: "white",
                                    position: "absolute",
                                    top: "10px",
                                    right: "10px",
                                    zIndex: "1030"
                                }}
                                onClick={() => navigate(-1)}
                            ></button>

                            <video className="video-fluid"
                                autoPlay={true}
                                loop controls muted
                                id="cspd_video"
                                poster={movieData.tmdbData.backdrop_path}
                                style={{ width: "100%", height: "550px", }}
                            >
                                <source src={movieData.downloadLink} />
                            </video>

                        </div>

                        ||

                        <div className="row g-0" style={{
                            background: "rgba(0,0,0,0.7)",
                            height: "550px",
                        }}>
                            <div className="col-md-4 my-4">
                                <img
                                    src={`https://image.tmdb.org/t/p/w500${movieData.tmdbData.poster_path}`}
                                    className="img-fluid rounded-start mx-5 mt-4" alt="..."
                                    style={{
                                        height: "400px",
                                        boxShadow: "0px 0px 20px 20px black"
                                    }}
                                />
                                {
                                    provider && (provider.buy !== null && provider.buy.length > 0) || (provider.rent !== null && provider.rent.length > 0) || (provider.flatrate !== null && provider.flatrate.length > 0) ?
                                        <span
                                            className="btn btn-dark mx-5 my-0 text-center"
                                            style={{
                                                width: "16.7rem"
                                            }}
                                        >
                                            <b className="mx-2" onClick={() => setWatchProviser(!watchProvider)} >
                                                {watchProvider ? "Close" : "Stream On ▶"}
                                            </b>
                                        </span>
                                        : ""
                                }
                            </div>



                            <div className="col-md-8">
                                <div className="card-body ms-5 my-5">
                                    <h1 className="card-title"><b>{movieData.name} ({movieData.tmdbData.release_date.split("-")[0]})</b></h1>
                                    {
                                        !watchProvider ?
                                            <p className="card-text">

                                                <div className="row">
                                                    <div className="col-4" style={{ width: "200px" }}>
                                                        {release_date && <span>{release_date} </span>}
                                                        {movieData.tmdbData.runtime && <span><span> | </span>{Math.floor(movieData.tmdbData.runtime / 60)}h {movieData.tmdbData.runtime % 60}m </span> || ""}
                                                        <br />
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
                                                    </div>
                                                    <div className="col">
                                                        <a className="" href={`https://www.imdb.com/title/${movieData.tmdbData.imdb_id}`} target="_blank" >
                                                            <img type="button" className=" btn btn-warning my-1 mx-1" src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg"
                                                                style={{
                                                                    width: "5rem",
                                                                }}
                                                                data-placement="top" title="IMDB Link"
                                                            />
                                                        </a>
                                                    </div>
                                                </div>
                                                <div>
                                                    {
                                                        movieData.tmdbData.tagline
                                                        && <p className="my-3"><q>{movieData.tmdbData.tagline}</q></p>
                                                    }
                                                </div>

                                                <div>
                                                    <p type="text" className=" my-3" style={{ width: "12rem" }}>
                                                        <b className="progress" style={{ border: "2px solid" }}>
                                                            <span className="progress-bar progress-bar-striped bg-warning" role="progressbar" style={{ width: `${parseInt(movieData.tmdbData.vote_average * 10)}%` }} aria-valuenow={parseInt(movieData.tmdbData.vote_average * 10)} aria-valuemin="0" aria-valuemax="100">{parseInt(movieData.tmdbData.vote_average * 10)}%</span>
                                                        </b>
                                                        <span>Ratting from <b>{movieData.tmdbData.vote_count}</b> users</span>
                                                    </p>
                                                </div>


                                                <div className="bg-white text-dark m-0 p-0" style={{ width: "150px" }}>
                                                    <LikeIcon recordId={movieData.recordId} userId={user.userId} isLiked={movieData.isLiked} />
                                                    <WatchlistIcon recordId={movieData.recordId} userId={user.userId} isAddedToWatchList={movieData.isWatchListed} />
                                                </div>

                                                <div className="my-3">
                                                    <details>
                                                        <summary >
                                                            <b style={{ fontWeight: "bold" }}>Storyline: </b>
                                                        </summary>
                                                    </details>
                                                    <p className="mx-3" style={{ height: "6rem", overflowY: "auto" }}>{movieData.tmdbData.overview}</p>
                                                </div>
                                            </p>

                                            :

                                            <Providers title={movieData.name} provider={provider} />
                                    }
                                </div>
                            </div>
                        </div>
                    }
                </div>




                <div className="mx-5" style={{
                    background: "rgba(255,255,255,0.9)"
                }}>
                    <div className="container">
                        <div className="row g-2">
                            <div className="col-12 my-5">
                                <Credits cast={cast} crew={crew} />
                            </div>
                        </div>

                        <div className="row g-2">
                            {
                                movieData.tmdbData.videos.length !== 0
                                &&
                                <div className="col-6">
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
                                                <table className="mx-3">
                                                    <thead>
                                                        {

                                                            movieData.tmdbData.videos.map(video => {
                                                                return <td className="">
                                                                    <iframe
                                                                        src={`https://www.youtube.com/embed/${video.key}`}
                                                                        className=""
                                                                        style={{
                                                                            // width: "100%",
                                                                            height: "12.5rem"
                                                                        }}
                                                                        allowFullScreen={true}
                                                                    >
                                                                    </iframe>
                                                                </td>
                                                            })
                                                        }
                                                    </thead>
                                                </table>
                                            </ul>

                                        </div>
                                    </div>

                                </div>
                            }
                            <div className="col-6">
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
                            </div>

                            {/* <div className="col-6 my-5">
                            <div className="mx-3">
                                <h5>
                                    <details>
                                        <summary>
                                            Media Info
                                        </summary>
                                    </details>
                                </h5>

                                <div className="mx-auto my-2" style={{ width: "20rem" }}>
                                    <table className="table table-bordered border-2 border-dark table-hover text-center ">
                                        <tr scope="row">
                                            <th scope="col">
                                                Type
                                            </th>
                                            <td scope="col">
                                                {movieData.category}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>
                                                Name
                                            </th>
                                            <td>
                                                {movieData.name} ({movieData.tmdbData.release_date.split("-")[0]})
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>
                                                Quality
                                            </th>
                                            <td>
                                                {movieData.quality}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>
                                                Size
                                            </th>
                                            <td>
                                                {movieData.size} {movieData.sizeFormat}
                                            </td>
                                        </tr>

                                    </table>
                                </div>

                            </div>
                        </div> */}
                        </div>
                    </div>

                </div>

            </div >
    )
}

export default MovieDetailsDesktop;