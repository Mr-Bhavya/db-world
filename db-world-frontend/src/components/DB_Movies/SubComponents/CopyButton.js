import React, { useState } from 'react'
import { Button } from 'react-bootstrap';
import CommonServices from '../../CommonServices';

const CopyButton = ({ text }) => {
    const [isUrlCopied, setIsUrlCopied] = useState(false);
    {
        isUrlCopied ?
            <Button variant="success">
                Copied !
            </Button>
            :
            <Button variant="dark" onClick={() => {
                CommonServices.handleCopy(text)
                setIsUrlCopied(true)
                setInterval(() => {
                    setIsUrlCopied(false)
                }, 5000)

            }}>
                Copy download link
            </Button>
    }

}

export default CopyButton;