import React, { useState } from 'react'
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { saveUserEventInfo } from '../../ApiServices';

const DownloadButton = (props) => {
    const { text, eventValue } = props;
    const handleDownload = async () => {
        saveUserEventInfo("DOWNLOAD", eventValue);
        if (Capacitor.isNativePlatform()) {
            Browser.open(text)
        } else {
            window.open(text);
        }
    }

    return (
        <button className='btn btn-sm' onClick={() => handleDownload()} >
            <img src="https://img.icons8.com/?size=100&id=108635&format=png&color=000000"
                style={{ width: "2rem" }}
                alt="download" title="Download"
            />
            <br />
            <b style={{ fontSize: "0.6rem" }}>
                Download
            </b>
        </button>
    )

}

export default DownloadButton;