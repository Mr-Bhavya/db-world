import React, { useState } from "react";
import Constants from "../../Constants";
import { deleteDbCinemaRecord } from "../../ApiServices";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { reloadMovies } from "../../../redux/action/allActions";
import { Button, Carousel, Modal } from "react-bootstrap";

const YoutubeTrailerModal = ({ movie, userRole }) => {
    const [show, setShow] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return (
        <span>

            {/* <span key={movie?.recordId} onClick={handleShow}>
                🗑️
            </span> */}

            <img type="button" src="https://img.icons8.com/color/48/000000/youtube-play.png"
                style={{ width: "2.5rem" }}
                onClick={handleShow}
            />

            {/* Youtubr Trailer Model */}
            <Modal show={show} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>{movie.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {
                        movie?.tmdbData?.videos?.length == 0 &&
                        <div className="d-flex justify-content-center align-items-center">
                            <div className="alert alert-danger text-center" role="alert">
                                No media available for this record
                            </div>
                        </div>
                    }

                    <Carousel data-bs-theme="light" >
                        {
                            movie?.tmdbData?.videos?.map((video, index) => {
                                return (
                                    <Carousel.Item>
                                        <iframe
                                            src={`https://www.youtube.com/embed/${video?.key}`}
                                            className="d-block w-100"
                                            width="100%"
                                            height="220rem"
                                            allowFullScreen={true}
                                        ></iframe>
                                    </Carousel.Item>
                                )
                            })
                        }
                    </Carousel>


                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </span>
    )
}

export default YoutubeTrailerModal;