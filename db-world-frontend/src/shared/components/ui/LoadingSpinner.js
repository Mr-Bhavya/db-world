import React from 'react';
import spinner from '@assets/images/spinner.gif'
import './LoadingSpinner.css';

function LoadingSpinner() {
    return (
        <div className='d-flex align-items-center justify-content-center'>
            {/* <img src={spinner} alt="Loading" /> */}

                <div aria-label="Orange and tan hamster running in a metal wheel" role="img" 
                    className="wheel-and-hamster border border-white rounded-circle " style={{background:"rgba(255, 255, 255, 0.9)"}}>
                    <div className="wheel"></div>
                    <div className="hamster">
                        <div className="hamster__body">
                            <div className="hamster__head">
                                <div className="hamster__ear"></div>
                                <div className="hamster__eye"></div>
                                <div className="hamster__nose"></div>
                            </div>
                            <div className="hamster__limb hamster__limb--fr"></div>
                            <div className="hamster__limb hamster__limb--fl"></div>
                            <div className="hamster__limb hamster__limb--br"></div>
                            <div className="hamster__limb hamster__limb--bl"></div>
                            <div className="hamster__tail"></div>
                        </div>
                    </div>
                    <div className="spoke"></div>
                </div>

            </div>
        // <div classNameName='d-flex justify-content-center'>
        //     <div classNameName="spinner-border text-danger m-5" role="status">
        //         <span classNameName="sr-only text-center"></span>
        //     </div>
        // </div>
    )

}

export default LoadingSpinner;