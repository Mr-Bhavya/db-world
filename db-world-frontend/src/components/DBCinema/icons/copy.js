import React, { useState } from 'react';
import CommonServices from '../../CommonServices';
import { Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Constants from '../../Constants';

const Copy = ({ text }) => {
    const [copyText, setCopyText] = useState(null);

    const handleCopy = (text) => {
        setCopyText(text);
        CommonServices.handleCopy(text)
        toast.success("Text is copied to clipboard");
        setTimeout(() => {
            setCopyText(null);
        }, 2000);
    }

    return (
        <span>
            <Button
                size="sm"
                variant="outline-light"
                className={`btn-sm me-2 ${copyText === text ? "btn-copy-success" : ""}`}
                onClick={() => handleCopy(text)}
            >
                {copyText == text ? (
                    <>
                        <i className="fas fa-check"></i> Copied
                    </>
                ) : (
                    <>
                        <i className="fas fa-copy"></i> Copy URL
                    </>
                )}
            </Button>
        </span>
    )
}

export default Copy;