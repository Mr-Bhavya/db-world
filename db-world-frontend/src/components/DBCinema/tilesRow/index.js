import React, { useEffect, useRef, useState } from 'react'
import "./tilesrow.css"
import ImageCard from './ImageCard';

export default function TilesRow({ title, requestUrl, horizontal }) {
   
    return (
        <div className='row-container'>
            {/* <div></div> */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                    style={{
                        width: "5px",
                        height: "30px",
                        backgroundColor: "red"
                    }}
                ></div>
                <h3 className="row-title" style={{ marginLeft: "20px", marginTop:"10px" }}>{title}</h3>
            </div>

            <ImageCard title={title} horizontal={horizontal} requestUrl={requestUrl} />
        </div>
    )
}
