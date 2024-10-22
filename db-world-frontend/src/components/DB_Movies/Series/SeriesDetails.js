import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Constants from "../../Constants";
import LoadingSpinner from "../../LoadingSpinner";
import { getRecordDetailsbyId } from "../../ApiServices";
import Providers from "../SubComponents/Providers";
import Credits from "../SubComponents/Credits";
import LikeIcon from "../SubComponents/LikeIcon";
import WatchlistIcon from "../SubComponents/WatchlistIcon";

function SeriesDetails() {

    let user = JSON.parse(localStorage.getItem("user"))
    console.log(user);
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
    const [seriesData, setSereisData] = useState("");
    const [loader, setLoader] = useState(true);
    const [cast, setCast] = useState([]);
    const [crew, setCrew] = useState([]);
    const [season, setSeason] = useState({});
    const [provider, setProvider] = useState({
        "buy": [],
        "rent": [],
        "flatrate": []
    });
    // const eachSeason = seriesData.tmdbData.seasons.filter(ele => ele.name === season);
    var count = 0;

    const getMovie = async () => {


        let recordResponse = await getRecordDetailsbyId(id);
        if (recordResponse.httpStatusCode === 200) {
            let series = recordResponse.data;
            series["tmdbData"] = series?.type == Constants.RECORD_TYPE_MOVIE ? series?.movieTmdb : series?.seriesTmdb;
            if (series === "No results found") {
                navigate(Constants.DB_WORLD_HOME_ROUTE);
            }
            else {
                setProvider({
                    "buy": series.tmdbData.providers?.buy || null,
                    "rent": series.tmdbData.providers?.rent || null,
                    "flatrate": series.tmdbData.providers?.flatrate || null
                });
                setCast(series.tmdbData.credits.cast);
                setCrew(series.tmdbData?.credits?.crew);
                setSereisData(series);
                setSeason(series.tmdbData.seasons[0])
            }
            setLoader(false);
        }
        else if (recordResponse.httpStatusCode === 401) {
            navigate(await Constants.REDIRECT(Constants.DB_SERIES_DETIALS_ROUTE + "?id=" + id), { replace: true });
        }
        else {
            console.log(recordResponse.message);
            navigate(Constants.DB_WORLD_HOME_ROUTE);
        }
    }
    useEffect(() => {
        getMovie()
    }, []);

    if (seriesData.tmdbData) {

        var release_date = ""
        if (seriesData.tmdbData.first_air_date) {
            release_date = seriesData.tmdbData.first_air_date.split("-");
            release_date.reverse();
            release_date = release_date.join("/");
        }

    }



    return (
        loader && <LoadingSpinner />
        ||
        <div className="mx-auto" style={{ background: "rgba(255 ,255 ,255, 0.9)", maxWidth: "1000px", border: "2px Soild white" }}>

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
                        href={seriesData.downloadLink}
                    >
                        <img
                            // className="btn btn-danger btn-sm"
                            // style={{ borderRadius: "50%", width:"80%" }}
                            target="_blank"
                            src="https://img.icons8.com/external-soft-fill-juicy-fish/60/000000/external-download-essentials-soft-fill-soft-fill-juicy-fish.png" />
                    </a>
                </div>

                <div className="card bg-dark text-white" style={{
                    background: "rgba(0,0,0,0.5)",
                }}>
                    <img
                        src={seriesData.tmdbData.backdrop_path && `https://image.tmdb.org/t/p/original${seriesData.tmdbData.backdrop_path}` || `https://wallpapercave.com/dwp1x/wp3377140.jpg`}
                        className="card-img"
                        style={{
                            // height:"15rem"
                            height: "auto"
                        }}
                        alt={seriesData.name} />
                    <div className="card-img-overlay my-auto"
                        style={{
                            background: "rgba(0,0,0,0.7)",
                        }}>
                        <img
                            src={`https://image.tmdb.org/t/p/w500${seriesData.tmdbData.poster_path}`}
                            className="img-fluid"
                            alt={seriesData.name}
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
                            <h5 className="card-title mx-3"><b>{seriesData.name} ({seriesData.tmdbData.first_air_date.split("-")[0]})</b></h5>
                            <div className="card-text mx-3">
                                {release_date && <span>{release_date} </span>}
                                {seriesData.tmdbData.runtime && <span><span> | </span>{Math.floor(seriesData.tmdbData.runtime / 60)}h {seriesData.tmdbData.runtime % 60}m </span> || ""}
                                <br />
                                {/* <span> | </span> */}
                                <span>
                                    {
                                        seriesData.tmdbData.genres.map(ele => {
                                            count++;
                                            if (count === seriesData.tmdbData.genres.length) {
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
                                        seriesData.tmdbData.tagline
                                        && <p className="my-3"><q>{seriesData.tmdbData.tagline}</q></p>
                                        || <p type="text-center" className="text-center mt-3">
                                            <b className="progress w-100" style={{ border: "2px solid" }}>
                                                <span className="progress-bar progress-bar-striped bg-warning" role="progressbar" style={{ width: `${seriesData.tmdbData.vote_average * 10}%` }} aria-valuenow={seriesData.tmdbData.vote_average * 10} aria-valuemin="0" aria-valuemax="100">{seriesData.tmdbData.vote_average * 10}%</span>
                                            </b>
                                            <span>Ratting from <b>{seriesData.tmdbData.vote_count}</b> users</span>
                                        </p>

                                    }

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-body text-center">
                    <h1 className="card-title">
                        {seriesData.name} ({seriesData.tmdbData.first_air_date.split("-")[0]})
                        &nbsp;
                        <a className="mx-3" href={`https://www.imdb.com/title/${seriesData.tmdbData.imdb_id}`} target="_blank" >
                            <button className=" btn btn-sm btn-warning"><b>IMDB</b></button>
                        </a>
                    </h1>

                    <div className="row g-0 m-3 d-flex justify-content-center">
                        <div className="" style={{ width: "6rem" }} >
                            <b className="progress" style={{ border: "2px solid", width: "6rem" }}>
                                <span className="progress-bar progress-bar-striped bg-warning" role="progressbar"
                                    style={{ width: `${parseInt(seriesData.tmdbData.vote_average * 10)}%` }}
                                    aria-valuenow={parseInt(seriesData.tmdbData.vote_average * 10)}
                                    aria-valuemin="0"
                                    aria-valuemax="100">{parseInt(seriesData.tmdbData.vote_average * 10)}%</span>
                            </b>
                            <span>Ratting from <br /><b>{seriesData.tmdbData.vote_count}</b> users</span>
                        </div>

                        <div style={{width:"150px"}}>
                            <LikeIcon recordId={seriesData.recordId} userId={user.userId} />
                            <WatchlistIcon recordId={seriesData.recordId} userId={user.userId} />
                        </div>
                    </div>

                </div>

                <Providers title={seriesData.name} provider = {provider} />

                <div className="m-3">
                    <details>
                        <summary >
                            <b style={{ fontWeight: "bold" }}>Storyline: </b>
                        </summary>
                    </details>
                    <p className="mx-3">{seriesData.tmdbData.overview}</p>
                </div>


                <div className="mx-3 my-3">
                    <ul>
                        <li>
                            <p><b>Number Of Seasons : </b>{seriesData.tmdbData.number_of_seasons}</p>
                        </li>
                        <li>
                            <p><b>Number Of Episodes : </b>{seriesData.tmdbData.number_of_episodes}</p>
                        </li>
                    </ul>
                </div>

                <ul className="nav nav-pills mx-3 my-3" style={{ overflowX: "auto" }}>
                    <table>
                        <thead>
                            {
                                seriesData.tmdbData.seasons.map(ele => {
                                    return (
                                        <td>
                                            <button className={season.name === ele.name ? "btn btn-dark mx-2" : "btn btn-outline-secondary mx-2"}
                                                style={{ width: "100px" }}
                                                onClick={() => setSeason(ele)}>
                                                {ele.name}
                                            </button>
                                        </td>
                                    )
                                })
                            }
                        </thead>
                    </table>
                </ul>

                <div>
                    <div className="card my-3"
                    // style="max-width: 540px;"
                    >
                        <div className="row g-0">
                            <div className="col-4">
                                <img src={`https://image.tmdb.org/t/p/original${season.poster_path}`} className="img-fluid rounded-start mx-1 my-3" alt={season.name} />
                            </div>
                            <div className="col-8">
                                <div className="card-body">
                                    <h5 className="card-title">{season.name}</h5>
                                    <hr />
                                    <p className="card-text"><b>{season.name} release date : </b>{season.air_date}</p>
                                    <p className="card-text"><b>Number of episodes in {season.name} : </b>{season.episode_count}</p>
                                </div>
                            </div>
                        </div>
                        <div className="g-0">
                            {
                                season.overview &&
                                <p className="mx-3 my-3"><b>Overview : </b>{season.overview}</p>
                            }
                        </div>
                    </div>
                </div>

                <Credits cast={cast} crew={crew} />

                {
                    seriesData.tmdbData.videos.length !== 0
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
                                        {

                                            seriesData.tmdbData.videos.map(video => {
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
                                    </thead>
                                </table>
                            </ul>

                        </div>
                    </div>
                }
            </div>
        </div>
    )


}

export default SeriesDetails;