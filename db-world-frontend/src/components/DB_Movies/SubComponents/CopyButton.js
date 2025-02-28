import React, { useState } from 'react'
import CommonServices from '../../CommonServices';
import { saveUserEventInfo } from '../../ApiServices';

const CopyButton = (props) => {
    const { text, eventValue } = props;
    const [isUrlCopied, setIsUrlCopied] = useState(false);

    return (
        <>
            {
                isUrlCopied ?
                    <button
                        className="btn btn-sm btn-outline-success mx-1" >
                        <img src="https://img.icons8.com/?size=100&id=Q3pOtOlQHwFK&format=png&color=000000"
                            style={{ width: "2rem" }}
                            alt="copied" title="Copy Done"
                        />
                        <br />
                        <b style={{ fontSize: "0.6rem" }}>
                            Copied !!
                        </b>
                    </button>
                    :
                    <button
                        className="btn btn-sm mx-1"
                        onClick={() => {
                            CommonServices.handleCopy(text)
                            saveUserEventInfo("DOWNLOAD", eventValue);
                            setIsUrlCopied(true)
                            setInterval(() => {
                                setIsUrlCopied(false)
                            }, 5000)

                        }}>
                        <img src="https://img.icons8.com/?size=100&id=113857&format=png&color=000000"
                            style={{ width: "2rem" }}
                            alt="copy" title="Copy Text"
                        />
                        <br />
                        <b style={{ fontSize: "0.6rem" }}>
                            Copy
                        </b>

                    </button>
            }
        </>
    )

}

export default CopyButton;