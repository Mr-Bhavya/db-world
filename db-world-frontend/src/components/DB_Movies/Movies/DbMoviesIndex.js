import React, { useEffect } from "react";


function DbMoviesIndex() {

    var iframeURL = 'https://bhavya-shared-drive.dbmovies0.workers.dev/3:/';
    var iframeID = 'dbmoviesindex';

    function loadIframe() {
        //pre-authenticate
        var req = new XMLHttpRequest();
        req.open("GET", iframeURL, false, "username#", "password@"); //use POST to safely send combination

        //setiFrame's SRC attribute
        var iFrameWin = document.getElementById(iframeID);
        iFrameWin.src = iframeURL.replace("https://", "https://username%23:password%40@");
    }

    useEffect(() => {
        // loadIframe();
    }, [])

    return (
        <div className="m-1" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px", minHeight: "100vh" }}>
            <iframe
                id={iframeID}
                className="m-3 w-100"
                autoFocus={true}
                title="DbMoviesIndex"
                loading="eager"
                src={iframeURL}
            />
        </div>
    )
}

export default DbMoviesIndex;