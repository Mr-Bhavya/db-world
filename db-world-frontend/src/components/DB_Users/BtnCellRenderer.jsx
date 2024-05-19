import React from "react";
import Constants from "../Constants";
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { useState } from "react";
import CommonServices from "../CommonServices";
import Profile_Admin from "../DB_Admin_Tools/Profile_Admin";

const BtnCellRenderer = (props) => {

  let _id = props.data._id;

  const [show, setShow] = useState(false);
  const [deleteModelShow, setDeleteModelShow] = useState(false);
  const [viewModelShow, setViewModelShow] = useState(false);

  const handleClose = (modelShow) => {
    if (modelShow === "deleteModelShow") {
      setDeleteModelShow(false);
    } else if (modelShow === "viewModelShow") {
      setViewModelShow(false);
    }
  }
  const handleShow = (modelShow) => {
    if (modelShow === "deleteModelShow") {
      setDeleteModelShow(true);
    }
    else if (modelShow === "viewModelShow") {
      setViewModelShow(true);
    }
  }

  const onCellEditBtnClicked = () => {
    console.log(props);
    props.clicked("edit", props);
  }

  const onCellDeleteBtnClicked = () => {
    console.log(props);
    props.clicked("delete", props);
    handleClose();
  }

  return (
    <div>
      {/* <button className='btn btn-dark btn-sm mx-1' onClick={onCellEditBtnClicked} >Edit</button> */}

      <Button className="btn btn-sm h-1" variant="" onClick={() => handleShow("viewModelShow")} data-toggle="tooltip" data-placement="bottom" title="View Profile" >
        <img src={Constants.VIEW_USER_ICON_URL} style={{ width: "20px", }} alt="view" aria-label="view" />
      </Button>

      <Button className="btn btn-sm h-1" variant="" onClick={() => handleShow("deleteModelShow")} data-toggle="tooltip" data-placement="bottom" title="Delete User">
        <img src={Constants.DELETE_ICON_URL} style={{ width: "20px", }} alt="Delete" aria-label="Delete" />
      </Button>

      <Modal show={viewModelShow} onHide={() => handleClose("viewModelShow")}>
        <Modal.Header closeButton>
          <Modal.Title>User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "40rem", overflow: 'auto' }}>
          {/* <Profile
            userData={props.data}
          /> */}
          <Profile_Admin userData = {props.data} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => handleClose("viewModelShow")}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={deleteModelShow} onHide={() => handleClose("viewModelShow")}>
        <Modal.Header closeButton>
          <Modal.Title>Delete User Conformation</Modal.Title>
        </Modal.Header>
        <Modal.Body>Do you want to delete user from database ?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => handleClose("deleteModelShow")}>
            No, Close it
          </Button>
          <Button variant="danger" onClick={onCellDeleteBtnClicked}>
            Yes, Delete it
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  )

}

export default BtnCellRenderer;
