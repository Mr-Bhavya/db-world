
{/* Movie Watch and Download Button */ }
<div className="card-footer">
    <div className="table-responsive">
        <div className="row mx-1 my-1">

            <div className="gap-1 d-md-flex justify-content-md-center">
                {
                    movie.category === "Movie" && <button type="button" className="btn btn-dark btn-sm mx-1" data-bs-toggle="modal" data-bs-target={watchModelTargetSrc} onClick={() => {
                        setSetVideo(true)
                    }}>📽 watch</button>
                }
                <a href={movie.downloadLink} className="btn btn-warning btn-sm mx-1" target="_blank">📥 Download</a>
                <img
                    onClick={() => navigate((movie.category.toLowerCase() === "movie" ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE) + `?id=${movie.id}`)}
                    style={{ width: "35px" }} src="https://img.icons8.com/ios-filled/50/000000/info.png" />
            </div>


            {/* Watch Movie Model */}
            {
                movie.category === "Movie" && <div className="modal fade" id={watchModelTargetDes} tabIndex="-1" aria-labelledby={watchModelTargetDes} aria-hidden="true">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={
                                    () => {
                                        setSetVideo(false);
                                        setCopySuccess({
                                            className: "btn btn-primary btn-sm",
                                            lable: "Copy Link "
                                        })
                                    }
                                }></button>
                            </div>

                            {/* Video On or Off */}
                            <div className="modal-body">
                                <h5 className="modal-title me-3" id={watchModelTargetDes}>{movie.name}</h5>
                                <hr />
                                {setVideo ? video : ""}  {/* Noob Way */}
                                <hr />
                                <p className="text-danger"><b>*Note:</b> If video/audio is not playing then copy link, open MX Player app and paste link in "Network Stream" option.</p>
                            </div>

                            {/* In Model Copy, Close, Download Button */}
                            <div className="modal-footer" id={watchModelTargetDes}>
                                <button type="button" className="btn btn-secondary btn-sm me-3" data-bs-dismiss="modal" aria-label="Close" onClick={
                                    () => {
                                        setSetVideo(false);
                                        setCopySuccess({
                                            className: "btn btn-primary btn-sm",
                                            lable: "Copy Link "
                                        })
                                    }
                                }>Close</button>
                                <button className={copySuccess.className} onClick={onCopy}>
                                    {copySuccess.lable}
                                </button>
                                <a href={movie.downloadLink} className="btn btn-warning btn-sm ms-3"> 📥 Download 📥</a></div>
                        </div>
                    </div>
                </div>
            }
        </div>
    </div>
</div>