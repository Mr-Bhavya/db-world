import React, { useState } from "react";
import Constants from "../../Constants";
import { deleteDbCinemaRecord } from "../../ApiServices";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { reloadMovies } from "../../../redux/action/allActions";
import { Button, Modal } from "react-bootstrap";

const DeleteModal = ({ movie, userRole }) => {
    const [show, setShow] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    async function onDelete() {
        try {
            let deleteRes = await deleteDbCinemaRecord(movie.recordId)
            if (deleteRes.httpStatusCode === 200) {
                dispatch(reloadMovies());
                toast.success(deleteRes.message)
                handleClose();
            } else if (deleteRes.httpStatusCode === 401) {
                toast.error(deleteRes.message + Constants.RE_LOGIN)
                navigate(await Constants.REDIRECT());
            }
            else {
                toast.error(deleteRes.message);
            }
        } catch (err) {
            console.log(err);
            alert(err);
        }
    }

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return (
        <div>

            <span key={movie?.recordId} onClick={handleShow}>
                🗑️
            </span>

            {/* Delete Movie Model */}
            <Modal show={show} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Conform Delete ?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <b>You want to delete this record?</b>
                    <br />
                    Record Id: {movie?.recordId}<br />
                    Record Name: {movie?.name}<br />
                    Record Type: {movie?.type}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="danger" onClick={onDelete} >
                        Yes, Delete it!
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    )
}

export default DeleteModal;