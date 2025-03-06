import React from "react";
import { useNavigate } from "react-router-dom";
import Constants from "../../Constants";

function Download({ record, userId }) {

    const navigate = useNavigate();

    return (
        <>
            <button
                className="icon-button" aria-label="download"
                onClick={() => navigate(`${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(":recordId", record.recordId)}`, { state: { movie: record, userRole: "" } })}
            >
                <i className="fas fa-download" />
            </button>
        </>
    );
}

export default Download;
