import React from 'react';
import spinner from '../images/spinner.gif'

function LoadingSpinner() {
    return (
        <div
            style={{
                background: "rgba(255 ,255 ,255, 0.9)",
                marginTop: "10rem",
                color: "white",
                position: "absolute",
                top: "40%",
                left: "45%",
            }}>
            <img src={spinner} alt="Loading" />
        </div>
        // <div className='d-flex justify-content-center'>
        //     <div className="spinner-border text-danger m-5" role="status">
        //         <span className="sr-only text-center"></span>
        //     </div>
        // </div>
    )

}

export default LoadingSpinner;