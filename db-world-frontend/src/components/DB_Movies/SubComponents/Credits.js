import React from "react";


function Credits(props) {
    console.log(props)
    const { cast, crew } = props

    return (
        <div>
            <div>
                <h5 className="mx-3">
                    <details>
                        <summary>Movie Cast</summary>
                    </details>
                </h5>
                <div className="nav nav-pills table-responsive mx-2" style={{ overflowX: "auto" }}>
                    <table className="mx-3">
                        <thead>
                            <tr>
                                {
                                    cast.map(person => {
                                        if (person.profile_path) {
                                            return <td>
                                                <div className="text-center rounded-50" style={{ width: "8rem", height: "13rem" }}>
                                                    <img className="img-fluid rounded "
                                                        src={`https://image.tmdb.org/t/p/original${person.profile_path}`}
                                                        alt={person.name}
                                                        style={{ width: "8rem", height: "10rem" }}
                                                    />
                                                    {/* <br /> */}
                                                    <div className="bg-light text-left-dark md-auto rounded-bottom rounded-1" style={{ height: "3rem", overflowX: "auto" }}>
                                                        <div><b>{person.name}</b></div>
                                                        <div>{person.character}</div>
                                                    </div>
                                                </div>
                                            </td>
                                        }
                                    })
                                }
                            </tr>
                        </thead>
                    </table>
                </div>
            </div>

            {
                crew && crew !== null && crew.length > 0 ?
                    <div>
                        <h5 className="m-3">
                            <details>
                                <summary>Crew Member</summary>
                            </details>
                        </h5>
                        <div className="nav nav-pills table-responsive mx-2" style={{ overflowX: "auto" }}>
                            <table className="mx-3">
                                <thead>
                                    <tr>
                                        {
                                            [...new Map(crew.map(item =>
                                                [item['id'], item])).values()].map(person => {
                                                if (person.profile_path) {
                                                    return <td className="border-start border-dark mx-1">
                                                        <div class="row" style={{ width: "20rem", height: "10rem" }}>
                                                            <div class="col-sm-6" style={{ width: "10rem", height: "10rem" }}>
                                                                <img className="img-fluid rounded "
                                                                    src={`https://image.tmdb.org/t/p/original${person.profile_path}`}
                                                                    alt={person.name}
                                                                    style={{ width: "100%", height: "100%" }}
                                                                />
                                                            </div>
                                                            <div class="col-sm-6" style={{ width: "9rem", height: "10rem", overflowY: "auto" }} >
                                                                <div class="card-body-right mx-1" style={{}}>
                                                                    <p><b class="card-title">{person.original_name}</b></p>
                                                                    <p><b>Job: </b>{person.job}</p>
                                                                    <p><b>Department: </b>{person.department}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                }
                                            })
                                        }
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </div> : ""
            }
        </div>
    )
}

export default Credits;