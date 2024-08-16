import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import SingleMovie from '../SingleMovie';
import { useNavigate } from 'react-router-dom';
import Constants from '../../Constants';
import { searchRecord, searchStreamFile } from '../../ApiServices';
import File from '../Stream/File';
import CommonServices from '../../CommonServices';

function Search(props) {

    // const userList = useSelector(state => state.userReducer.userList);
    const userRole = props.userRole;
    const query = useSelector(state => state.searchReducer);
    const [searchMovieList, setSearchMovieList] = useState([]);
    const reload = useSelector(state => state.reloadMoviesReducer)
    const [loading, setLoading] = useState(true);
    const [isSearchRecordResDone, setIsSearchRecordResDone] = useState(false);
    const [isSearchStreamResDone, setIsSearchStreamResDone] = useState(false);
    const [streamList, setStreamList] = useState([]);
    const [movieId, setMovieId] = useState();
    const [setVideo, setSetVideo] = useState(false);
    const [modelParameter, setModelParameter] = useState({
        downloadLink: "",
        name: ""
    });
    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem('user')));
    const navigate = useNavigate()

    const searchMovie = async () => {
        try {
            setLoading(true)
            setIsSearchRecordResDone(false)
            setIsSearchStreamResDone(false)
            searchRecord(CommonServices.modifySearchQuery(query)).then(async searchResponse => {
                if (searchResponse.httpStatusCode === 200) {
                    setSearchMovieList(searchResponse.data)
                    setIsSearchRecordResDone(true)
                    // setLoading(false)
                } else if (searchResponse.httpStatusCode === 401) {
                    alert(searchResponse.message + Constants.RE_LOGIN);
                    navigate(await Constants.REDIRECT());
                } else {
                    alert(searchResponse.message);
                }
            })
            searchStreamFile(CommonServices.modifySearchQuery(query)).then(async searchStreamRes => {
                if (searchStreamRes.httpStatusCode === 200) {
                    setStreamList(searchStreamRes.data)
                    setIsSearchStreamResDone(true);
                    // setLoading(false)
                } else if (searchStreamRes.httpStatusCode === 401) {
                    alert(searchStreamRes.message + Constants.RE_LOGIN);
                    navigate(await Constants.REDIRECT());
                } else {
                    alert(searchStreamRes.message);
                }
            })
        } catch (err) {
            console.log(err);
        }
    }

    useEffect(() => {
        if (query != '' && query != null && typeof (query) != 'undefined') {
            searchMovie();
        }
    }, [query, reload])

    return (
        <div>

            <div className='mt-2'>
                <div>
                    <div style={{ textAlign: "center", border: "2px solid", padding: "1%", background: "rgba(255 ,255 ,255, 0.9)" }}>
                        {
                            query != '' && query != null && typeof (query) != 'undefined' ?
                                <div>
                                    <h4 className='rounded-pill my-3' style={{ textAlign: "center", border: "2px solid", padding: "1%", background: "rgba(255 ,255 ,255, 0.9)" }}>Search List</h4>
                                    {
                                        isSearchRecordResDone && isSearchStreamResDone ?
                                            <div>
                                                {streamList.map(
                                                    file => <File file={file} userRole={userRole} />
                                                )}
                                                {
                                                    searchMovieList.length == 0 && streamList.length == 0 &&
                                                    <h3 className='my-5'>Sorry, No Result Found for : <span className="alert-link">{query}</span></h3>
                                                }
                                            </div> :
                                            Constants.LOADER
                                    }
                                </div>
                                :
                                <h3 className='my-5'>Search movies and series by their name</h3>

                        }
                    </div>
                    {
                        isSearchRecordResDone && isSearchStreamResDone &&
                        <div className="row row-cols-1 row-cols-md-4 g-4 my-2">
                            {
                                searchMovieList.map((movie, index) => {
                                    return (
                                        <SingleMovie
                                            movie={movie}
                                            userData={userData}
                                            key={movie.id}
                                            id={index}
                                            userRole={userRole}
                                        />
                                    )
                                })
                            }
                        </div>
                    }
                </div>
            </div>
        </div>
    )
}

export default Search;