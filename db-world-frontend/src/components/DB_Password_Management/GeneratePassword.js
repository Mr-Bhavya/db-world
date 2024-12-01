import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Constants from '../Constants';

function GeneratePassword() {
    let hidePasswordIcon = "https://img.icons8.com/material-rounded/24/null/hide.png";
    let visiblePasswordIcon = "https://img.icons8.com/material-rounded/24/null/visible.png";
    const [generatedPassword, setGeneratedPassword] = useState("");
    const [passwordLength, setPasswordLength] = useState(8);
    const [isPasswordGenerated, setIsPasswordGenerated] = useState(false);

    const onInputChange = (e) => {
        if (e.target.id === "passwordLength") {
            setPasswordLength(parseInt(e.target.value));
        }
    }

    const copyPassword = () => {
        window.navigator.clipboard.writeText(generatedPassword);
        let copyPassword = document.getElementById("copyPassword");
        copyPassword.innerHTML = "Copied !!";
        copyPassword.className = "btn btn-success btn-sm m-3";
        setTimeout(() => {
            copyPassword.innerHTML = "Copy Password";
            copyPassword.className = "btn btn-primary btn-sm m-3";
        }, 1000)
    }

    const generatePassword = (passwordLength) => {

        setIsPasswordGenerated(false);

        let numbers = "1234567890";
        let upperLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let lowerLetters = upperLetters.toLowerCase();
        let specialCharacters = "~!@#$%^&*()_-+=<>{}[|]";
        let generatedPassword = "";
        let allCharacterArray = [numbers, upperLetters, lowerLetters, specialCharacters];
        console.log(passwordLength);
        passwordLength = typeof (passwordLength) === 'undefined' ? 10 : passwordLength;

        if (typeof (passwordLength) !== "number") {
            alert("Password length should be number.")
            setGeneratedPassword("");
            // return { status: false, result: "Password length should be number." }
        }
        else {
            if (passwordLength < 8 || passwordLength > 16) {
                setGeneratedPassword("");
                alert("password length should be between 8 and 16.")
                // return { status: false, result: "Password length should be between 8 and 16." }
            } else {
                let generatedString = "";
                for (let i = 0; i <= 3; i++) {
                    let pickUpString = allCharacterArray[i];
                    let j = 0;
                    let addNumber = pickUpString === lowerLetters ? passwordLength - 6 : 2;
                    while (j < addNumber) {
                        let character = pickUpString.charAt(Math.random() * pickUpString.length);
                        if (!generatedString.includes(character)) {
                            generatedString += character;
                            j++;
                        }
                    }
                }

                while (true) {
                    if (generatedPassword.length == generatedString.length) {
                        break;
                    }
                    else {
                        let character = generatedString.charAt(Math.random() * generatedString.length);
                        if (!generatedPassword.includes(character)) {
                            generatedPassword += character;
                        }
                    }
                }
                // return { status: true, result: generatedPassword };
                setIsPasswordGenerated(true);
                setGeneratedPassword(generatedPassword);
                console.log(generatedPassword);
            }
        }
    }

    const togglePassword = () => {

        if (document.getElementById("generatedPassword").type == "text") {
            document.getElementById("generatedPassword").type = "password";
            document.getElementById("togglePasswordIcon").src = hidePasswordIcon;
        } else {
            document.getElementById("generatedPassword").type = "text";
            document.getElementById("togglePasswordIcon").src = visiblePasswordIcon;
        }
    }

    // useEffect(() => {
    //     let authenticationRes = Authentication({ redirectTo: Constants.DB_GENERATE_PASSWORD_ROUTE });
    //     console.log(authenticationRes);
    //     if (authenticationRes.login) {
    //         setUserData(authenticationRes.user);
    //     }
    //     else {
    //         navigate(authenticationRes.redirectUrl, { replace: true });
    //     }
    // }, [])

    return (
        <div className="card mx-3 my-2" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
            <div className="card-header">
                <Link className='btn btn-outline-light btn-sm' to={Constants.DB_PASSWORD_MANAGER_ROUTE} style={{ float: "left" }}>
                    <img src="https://img.icons8.com/ios-glyphs/30/null/left.png" title="Go Back to Password Management" />
                </Link>
                <center><b><h2>Password Generater</h2></b></center>
            </div>
            <div className="mx-3">
                <div className="card-body">
                    <h5 className="card-title"><u>Generate Password</u></h5>
                    <ul className="card-text">
                        <li>This will generate password for requried length.</li>
                        <li>Password Will contains Numbers, Special Character, Caps and Small Letters.</li>
                        <li>Password length should be between 8 and 16.</li>
                    </ul>
                    <hr />
                    <div>
                        <label className="card-text" htmlFor="passwordLength"><b>Select Password length: </b></label>
                        <input className="m-1" type="number" id="passwordLength" value={passwordLength} min="8" max="16" onChange={onInputChange} />
                        <button className="btn btn-warning btn-sm mx-3" onClick={() => generatePassword(passwordLength)}>Generate</button>
                    </div>
                    <hr />
                    {
                        isPasswordGenerated &&
                        <div className="mx-1" >
                            <span>
                                <label className="card-text" htmlFor="generatedPassword"><b>Generated Password:  </b></label>
                                &nbsp;<input type="password" id="generatedPassword" value={generatedPassword} readOnly />
                                <img src={hidePasswordIcon} id="togglePasswordIcon" style={{ marginLeft: "-30px", cursor: "pointer" }} onClick={togglePassword} />
                            </span>
                            <button className="btn btn-primary btn-sm m-3" id="copyPassword" onClick={copyPassword}> Copy Password</button>
                        </div>
                    }

                </div>
            </div>
        </div>
    )
}

export default GeneratePassword;