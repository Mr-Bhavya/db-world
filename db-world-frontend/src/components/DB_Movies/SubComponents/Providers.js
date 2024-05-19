import React from "react";


function Providers(props) {
    const {title, provider} = props;

    return (
        <div>
            {
                provider && provider.flatrate !== null || provider.rent !== null || provider.buy !== null ?

                    <div className="mx-3">
                        <details>
                            <summary >
                                <b style={{ fontWeight: "bold" }}> {title} is currently available to stream, rent and buy in India. </b>
                            </summary>
                        </details>
                        <div className="m-3">

                            {
                                provider.flatrate !== null && provider.flatrate.length > 0 &&
                                <div>
                                    <b>Streaming On: </b>
                                    <div style={{ overflowX: "auto", width: "60%", display: "inline-block", textWrap: "nowrap", position: "absolute" }}>
                                        {
                                            provider.flatrate.map(
                                                flatrate => {
                                                    return (
                                                        <img
                                                            className="mx-2"
                                                            src={"https://www.themoviedb.org/t/p/original" + flatrate.logo_path}
                                                            style={{ width: "2rem" }}
                                                        />
                                                    )
                                                }
                                            )
                                        }
                                    </div>
                                    <hr />
                                </div>
                            }
                            {
                                provider.rent !== null && provider.rent.length > 0 &&
                                <div>
                                    <b>Rent On: </b>
                                    <div style={{ overflowX: "auto", width: "60%", display: "inline-block", textWrap: "nowrap", position: "absolute" }}>
                                        {
                                            provider.rent.map(
                                                rent => {
                                                    return (
                                                        <img
                                                            className="mx-2"
                                                            src={"https://www.themoviedb.org/t/p/original" + rent.logo_path}
                                                            style={{ width: "2rem" }}
                                                        />
                                                    )
                                                }
                                            )
                                        }
                                    </div>
                                    <hr />
                                </div>
                            }
                            {
                                provider.buy !== null && provider.buy.length > 0 &&
                                <div>
                                    <b>Buy From: </b>
                                    <div style={{ overflowX: "auto", width: "60%", display: "inline-block", textWrap: "nowrap", position: "absolute" }}>
                                        {
                                            provider.buy.map(
                                                buy => {
                                                    return (
                                                        <img
                                                            className="mx-2"
                                                            src={"https://www.themoviedb.org/t/p/original" + buy.logo_path}
                                                            style={{ width: "2rem" }}
                                                        />
                                                    )
                                                }
                                            )
                                        }
                                    </div>
                                    <hr />
                                </div>
                            }
                        </div>
                    </div>
                    : ""

            }
        </div>
    )
}

export default Providers;