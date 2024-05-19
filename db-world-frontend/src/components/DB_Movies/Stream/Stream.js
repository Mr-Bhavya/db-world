import React, { useEffect, useState } from "react";
import FileList from "./FileList";


function Stream() {


    return (
        <div className="m-1" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}>
            <FileList />
        </div>
    )
}

export default Stream;