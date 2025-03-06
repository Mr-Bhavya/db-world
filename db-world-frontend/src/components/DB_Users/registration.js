import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Constants from '../Constants';
import { register } from '../ApiServices';

function Registration() {

  const [check, setCheck] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [firstNameError, setFirstNameError] = useState(false);
  const [lastNameError, setLastNameError] = useState(false);
  const [genderError, setGenderError] = useState(false);
  const [dobError, setDobError] = useState(false);
  const [ageError, setAgeError] = useState(false);
  const [mobileNoError, setMobileNoError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [agreeCheckBoxError, setAgreeCheckBoxError] = useState(false);
  const [loader, setLoader] = useState(false);

  localStorage.setItem('login', false);
  localStorage.setItem('user', null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    age: "",
    mobileNo: "",
    email: "",
    agreeCheckBox: "",
    password: ""
  })

  function checkFieldError(name, value) {
    switch (name) {
      case "firstName": {
        if (!value || value === " " || /[" "]{2,}/.test(value)) {
          setFirstNameError(true)
        } else {
          setFirstNameError(false)
        }
        break;
      }

      case "lastName": {
        if (!value || value === " " || /[" "]{2,}/.test(value)) {
          setLastNameError(true)
        } else {
          setLastNameError(false)
        }
        break;
      }

      case "dob": {
        console.log(value);
        if (value && value.includes("-") && value.split("-").length === 3) {
          let year = value.split("-")[0];
          let month = value.split("-")[1];
          let date = value.split("-")[2];

          if ((month >= 1 || month <= 12) && (date >= 1 && date <= 31)) {
            setDobError(false);
          } else {
            setDobError(true);
          }
        }
        else {
          setDobError(true);
        }
        break;
      }

      case "gender": {
        if (!value || value === " ") {
          setGenderError(true)
        } else {
          setGenderError(false)
        }
        break;
      }

      case "mobileNo": {
        if (/^[0-9]{10}$/.test(value)) {
          setMobileNoError(false)
        } else {
          setMobileNoError(true)
        }
        break;
      }

      case "email": {
        if (!value || /[" "]{1,}/.test(value)) {
          setEmailError(true)
        } else {
          setEmailError(false)
        }
        break;
      }

      case "password": {
        if (!value || /[" "]{1,}/.test(value)) {
          setPasswordError(true)
        } else {
          setPasswordError(false)
        }
        break;
      }

      case "agreeCheckBox": {
        console.log(value)
        if (!value || value === " " || value === "false") {
          setAgreeCheckBoxError(true)
        } else {
          setAgreeCheckBoxError(false)
        }
        break;
      }
    }
  }

  useEffect(
    checkFieldError
    , [formData])

  const onFieldChange = (event) => {
    checkFieldError(event.target.name, event.target.value);
    setFormData({
      ...formData, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
    })
    // console.log(fieldError);
    // console.log(`${event.target.name} = ${event.target.value}`)
  }

  const onCheckBoxChange = (event) => {
    setCheck(!check);
    checkFieldError(event.target.name, event.target.value);
    onFieldChange(event);
  }

  const onSubmitHandle = async (e) => {

    e.preventDefault();
    setLoader(true)
    // checkFieldError();
    const { firstName, lastName, gender, dob, mobileNo, email, agreeCheckBox, password } = formData;

    if (!firstName || !lastName || !gender || !dob || !mobileNo || !email || !password || !agreeCheckBox) {
      !firstName && setFirstNameError(true)
      !lastName && setLastNameError(true)
      !dob && setDobError(true)
      !gender && setGenderError(true)
      !mobileNo && setMobileNoError(true)
      !email && setEmailError(true)
      !password && setPasswordError(true)
      toast.warning("Please Fill all required field.")
    } else {
      if (!firstNameError && !lastNameError && !genderError && !dobError && !mobileNoError && !emailError && !passwordError && !agreeCheckBoxError) {

        let registerRes = await register({ firstName, lastName, gender, dob, mobileNo, email, password })
        console.log(registerRes);
        if (registerRes.httpStatusCode === 201 || registerRes.httpStatusCode === 200) {
          toast.success("Registration Successfull. You will be navigate to login page.", {
            onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
            autoClose: 1000
          });
        } else if (registerRes.httpStatusCode === 401) {
          toast.error(registerRes.message + Constants.RE_LOGIN, {
            onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
            autoClose: 1000
          });
        } else {
          toast.error(registerRes?.message || registerRes?.error)
        }
      }
      else {
        toast.warning("Please Fill correct data.")
      }
    }
    setLoader(false)
  }



  return (<div style={{}}>
    <form className="row g-3 needs-validation mx-3 my-3 rounded-3" method="POST" noValidate style={{ background: "rgba(255 ,255 ,255, 0.9)", border: "2px solid", padding: "1% 2% 2% 2%" }}>
      <h1 style={{ borderBottom: "2px solid" }}>Registration Form</h1>
      <div className="col-md-4">
        <label htmlFor="validationCustom01" className="form-label">👤 First name <span className="text-danger">*</span> </label>
        {
          firstNameError ?
            <input type="text" className="form-control is-invalid" name="firstName" value={formData.firstName} onChange={onFieldChange} />
            :
            <input type="text" className="form-control" name="firstName" value={formData.firstName} onChange={onFieldChange} />
        }
        {firstNameError ? <div className="invalid-feedback">First Name Should not be empty</div> : ""}
      </div>
      <div className="col-md-4">
        <label htmlFor="validationCustom02" className="form-label">👤 Last name <span className="text-danger">*</span> </label>
        {lastNameError ?
          <input type="text" className="form-control is-invalid" name="lastName" value={formData.lastName} onChange={onFieldChange} />
          :
          <input type="text" className="form-control" name="lastName" value={formData.lastName} onChange={onFieldChange} />
        }
        {
          lastNameError ? <div className="invalid-feedback">Last Name Should not be empty</div> : ""
        }
      </div>
      <div className="col-md-3">
        <label htmlFor="validationCustom05" className="form-label">📞 Mobile Number <span className="text-danger">*</span> </label>
        {
          mobileNoError ?
            <input type="text" className="form-control is-invalid" name="mobileNo" onChange={onFieldChange} />
            :
            <input type="text" className="form-control" name="mobileNo" onChange={onFieldChange} />
        }
        {
          mobileNoError ?
            <div className="invalid-feedback">Mobile Number should be 10 Digit</div> : ""
        }
      </div>
      <div className="col-md-3">
        <label htmlFor="validationCustom04" className="form-label">👫 Gender <span className="text-danger">*</span> </label>
        {
          genderError ?
            <select className="form-select is-invalid" name="gender" defaultValue={formData.gender} onChange={onFieldChange}>
              <option disabled={true} value="">Choose...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            : <select className="form-select" name="gender" defaultValue={formData.gender} onChange={onFieldChange}>
              <option disabled={true} value="">Choose...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
        }
        {
          genderError ? <div className="invalid-feedback">Please Select gender</div> : ""
        }
      </div>
      <div className="col-md-2">
        <label htmlFor="validationCustom05" className="form-label">🅰 Date Of Birth <span className="text-danger">*</span> </label>
        {
          dobError ? <input type="date" className="form-control is-invalid" value={formData.dob} name="dob" onChange={onFieldChange} />
            : <input type="date" className="form-control" value={formData.dob} name="dob" onChange={onFieldChange} />
        }
        {
          dobError && <div className="invalid-feedback">Please enter valid birth date.</div>
        }
      </div>
      <div className="col-md-4">
        <label htmlFor="validationCustom03" className="form-label">📧 Email ID <span className="text-danger">*</span> </label>
        {
          emailError && <><input type="text" className="form-control is-invalid" name="email" value={formData.email} onChange={onFieldChange} />
            <div className="invalid-feedback">Please enter valid email address</div></>
          || <input type="text" className="form-control " name="email" value={formData.email} onChange={onFieldChange} />
        }

      </div>
      <div className="col-md-3">
        <label htmlFor="validationCustom03" className="form-label">🔐 Password <span className="text-danger">*</span> </label>
        {
          passwordError && <>
            <input type="password" className="form-control is-invalid" name="password" value={formData.password} onChange={onFieldChange} />
            <div className="invalid-feedback">Please Enter valid Password</div>
          </> || <input type="password" className="form-control" name="password" value={formData.password} onChange={onFieldChange} />
        }
      </div>

      <div className="col-12">
        <hr />
        <div className="form-check">
          {
            agreeCheckBoxError && <>
              <input className="form-check-input is-invalid" type="checkbox"
                name="agreeCheckBox" defaultChecked={!check} value={check} onChange={onCheckBoxChange} />
              <label className="form-chreck-label" htmlFor="invalidCheck">
                I agree to terms and conditions <span className="text-danger">*</span>
              </label>
              <div className="invalid-feedback">Please accept terms and conditions</div>
            </> || <><input className="form-check-input" type="checkbox"
              name="agreeCheckBox" defaultChecked={!check} value={check} onChange={onCheckBoxChange} />
              <label className="form-chreck-label" htmlFor="invalidCheck">
                I agree to terms and conditions <span className="text-danger">*</span>
              </label>
            </>
          }
        </div>
      </div>
      <div className="row">
        <div className="d-flex justify-content-strat my-3">
          {
            loader && <>
              <button className="btn btn-primary btn-sm" type="button" disabled>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                &nbsp;&nbsp;&nbsp;&nbsp; Registering...
              </button>
            </>
            || <button type="submit" className="btn btn-primary btn-sm" disabled={check} onClick={onSubmitHandle}>Register 📃</button>
          }
          <button type="submit" className="btn btn-outline-danger btn-sm mx-3" onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}>❌ Cancel</button>
        </div>
      </div>
    </form>
    {Constants.TOAST_CONTAINER}
  </div>
  )
}

export default Registration;