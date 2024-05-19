import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LoadingSpinner from '../LoadingSpinner';
import Authentication from '../Authentication';
import Constants from '../Constants';
import CommonServices from '../CommonServices';
import { updateUserDetails } from '../ApiServices';

function EditProfile(props) {
  var { user, isFromAdmin } = props;
  const location = useLocation();
  const [check, setCheck] = useState(true);
  const navigate = useNavigate();
  const [loader, setLoader] = useState(true);
  const [submitLoader, setSubmitLoader] = useState(false);
  const [firstNameError, setFirstNameError] = useState(false);
  const [lastNameError, setLastNameError] = useState(false);
  const [genderError, setGenderError] = useState(false);
  const [dobError, setDobError] = useState(false);
  const [mobileNoError, setMobileNoError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [agreeCheckBoxError, setAgreeCheckBoxError] = useState(false);
  const [formData, setFormData] = useState({})

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

  const validateToken = async () => {
    let isValidToken = await CommonServices.valiadteToken();
    if (!isValidToken) {
      console.log("Token Is invalid")
      navigate(await Constants.REDIRECT(Constants.EDIT_USER_PROFILE_ROUTE), { replace: true })
    } else {
      console.log("Token Is valid")
    }
    setLoader(false);
  }

  useEffect(() => {
    CommonServices.valiadteToken().then(async isValidToken => {
      if (!isValidToken) {
        navigate(await Constants.REDIRECT(Constants.EDIT_USER_PROFILE_ROUTE), { replace: true })
      } else {
        let authenticationRes = Authentication({ redirectTo: Constants.EDIT_USER_PROFILE_ROUTE });
        if (authenticationRes.login) {
          let userData = null;
          if (isFromAdmin) {
            userData = user;
          } else {
            userData = location && location.state && location.state.userData
              ? location.state.userData : authenticationRes.user;
          }
          setFormData({
            userId: userData.userId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            gender: userData.gender,
            dob: userData.dob ? userData.dob : "",
            age: userData.age ? userData.age : 0,
            mobileNo: userData.mobileNo,
            email: userData.email,
            userRole: userData.userRole,
            agreeCheckBox: userData.agreeCheckBox,
            password: userData.password
          })
          setLoader(false);
        }
        else {
          navigate(authenticationRes.redirectUrl, { replace: true });
        }
      }
    }).catch(err => {
      console.log(err);
    });
  }, [])

  const onFieldChange = (event) => {
    checkFieldError(event.target.name, event.target.value);
    setFormData({
      ...formData, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
    })
  }

  const onCheckBoxChange = (event) => {
    setCheck(!check);
    onFieldChange(event);
  }

  const onSubmitHandle = async (e) => {
    setSubmitLoader(true);
    e.preventDefault();

    const { userId, firstName, lastName, gender, dob, mobileNo, email, password } = formData;

    if (!firstName || !lastName || !gender || !dob || !mobileNo || !email || !password ) {
      !firstName && setFirstNameError(true)
      !lastName && setLastNameError(true)
      !dob && setDobError(true)
      !gender && setGenderError(true)
      !mobileNo && setMobileNoError(true)
      !email && setEmailError(true)
      !password && setPasswordError(true)
      toast.warning("Please Fill all required field.")
    } else {
      if (!firstNameError && !lastNameError && !genderError && !dobError && !mobileNoError && !emailError && !passwordError) {

        let updateUserRes = await updateUserDetails({ userId, firstName, lastName, gender, dob, mobileNo, email, password })
        if (updateUserRes.httpStatusCode === 200) {
          toast.success("User Profile Edited Successfull.", {
            onClose: () => {
              navigate(Constants.USER_PROFILE_ROUTE)
            },
            autoClose: 1000
          });
        }
        else if (updateUserRes.httpStatusCode === 401) {
          toast.error(updateUserRes.message + Constants.RE_LOGIN, {
            onClose: async () => {
              navigate(await Constants.REDIRECT(Constants.EDIT_USER_PROFILE_ROUTE));
            },
            autoClose: 1000
          })
        }
        else {
          toast.error(updateUserRes.message)
        }
      } else {
        toast.warning("Please Fill correct data.")
      }

      //   const res = await fetch(Constants.EDIT_USER_API, {
      //     method: "PUT",
      //     headers: {
      //       "content-type": "application/json"
      //     }, body: JSON.stringify({ userId, firstName, lastName, gender, dob, mobileNo, email, password })
      //   })

      //   const data = await res.json();
      //   console.log(data, "status=" + res.status);

      //   if (res.status === 422 || !data) {
      //     toast.warning("User already exists with this email.");
      //   }
      //   else if (res.status === 400 || !data) {
      //     toast.warning("Please fill all the fields.");
      //   }
      //   else if (res.status === 500) {
      //     toast.error("Failed Edited. Problem from server side.")
      //   }
      //   else if (res.status === 401) {
      //     toast.error(data.errorMessage + Constants.RE_LOGIN, {
      //       onClose: async () => {
      //         navigate(await Constants.REDIRECT(Constants.EDIT_USER_PROFILE_ROUTE));
      //       },
      //       autoClose: 1000
      //     })
      //   }
      //   else {
      //     toast.success("User Profile Edited Successfull.", {
      //       onClose: () => {
      //         let localUser = JSON.parse(localStorage.getItem('user'));
      //         // localUser.firstName = firstName;
      //         // localUser.lastName = lastName;
      //         // localUser.gender = gender;
      //         // localUser.dob = dob;
      //         // localUser.mobileNo = mobileNo;
      //         // localUser.email = email;
      //         // localUser.password = password;
      //         // localStorage.setItem('user', JSON.stringify(localUser));
      //         navigate(Constants.USER_PROFILE_ROUTE)
      //       },
      //       autoClose: 1000
      //     });
      //   }
      // }

    }
    setSubmitLoader(false);
  }

  return (
    !loader &&
    <div>
      <form className="row g-3 needs-validation mx-3 my-3 rounded-3" method="POST" noValidate style={{ background: "rgba(255 ,255 ,255, 0.9)", border: "2px solid", padding: "1% 2% 2% 2%", borderRadius: "3%" }}>
        <h1 style={{ borderBottom: "2px solid" }}>Edit User Profile</h1>

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
              <input type="text" className="form-control is-invalid" name="mobileNo" value={formData.mobileNo} onChange={onFieldChange} />
              :
              <input type="text" className="form-control" name="mobileNo" value={formData.mobileNo} onChange={onFieldChange} />
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
              <select className="form-select is-invalid" name="gender" value={formData.gender} onChange={onFieldChange}>
                <option disabled={true} value="">Choose...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              : <select className="form-select" name="gender" value={formData.gender} onChange={onFieldChange}>
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
          <label htmlFor="validationCustom05" className="form-label">📅 Date Of Birth <span className="text-danger">*</span> </label>
          {
            dobError ? <input type="date" className="form-control is-invalid" value={formData.dob} name="dob" min="1" max="100" onChange={onFieldChange} />
              : <input type="date" className="form-control" value={formData.dob} name="dob" onChange={onFieldChange} />
          }
          {
            dobError && <div className="invalid-feedback">Please enter valid DOB.</div>
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
          <div className="d-flex justify-content-strat me-3 my-3">
            {!submitLoader && <button type="submit" className="btn btn-primary" disabled={check} onClick={onSubmitHandle}>Submit 📃</button>
              || <button className="btn btn-primary btn-sm" type="button" disabled>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                &nbsp;&nbsp;&nbsp;&nbsp; Updating...
              </button>}
            <button type="submit" className="btn btn-outline-danger mx-3" onClick={() => navigate(Constants.USER_PROFILE_ROUTE)}>❌ Cancel</button>
          </div>
        </div>
      </form>
      <hr />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
    ||
    <LoadingSpinner />
  )
}

export default EditProfile;