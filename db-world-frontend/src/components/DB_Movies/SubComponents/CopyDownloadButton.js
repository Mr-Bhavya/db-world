import React from 'react'
import CopyButton from './CopyButton';
import DownloadButton from './DownloadButton';

const CopyDownloadButton = (props) => {
    const { text, eventValue } = props;
    return (
        <div className="float-end">
            <CopyButton text={text} eventValue={eventValue} />
            <DownloadButton text={text} eventValue={eventValue} />
        </div>
    )

}

export default CopyDownloadButton;