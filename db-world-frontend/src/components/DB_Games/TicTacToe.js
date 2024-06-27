import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Constants from "../Constants";

function TicTacToe() {

    const [b, setB] = useState(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    let index = 0;
    const [player, setPlayer] = useState(1);
    const [count, setCount] = useState(0);
    const [decision, setDecision] = useState(false);
    const [buttonColor, setButtonColor] = useState(["btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark"])
    const navigate = useNavigate();
    const [winStr, setWinStr] = useState("");

    useEffect(() => {
        // let authenticationRes = Authentication({redirectTo:"game"});
        // if(authenticationRes.login){
        //     test()
        // }
        // else{
        //     navigate(authenticationRes.redirectUrl, { replace: true });
        // }
        test()
    }, [b])

    const onSelection = (e) => {
        e.preventDefault();
        index = e.target.value;
        let newB = [...b];
        let newBColor = [...buttonColor];
        if (index === "x" || index === "O") {
            toast.warning("input already taken.")
        }
        else {
            if (player === 1) {
                newB[index - 1] = "x";
                newBColor[index - 1] = "btn btn-warning"
                setPlayer(2)
            }
            else if (player === 2) {
                newB[index - 1] = "O";
                newBColor[index - 1] = "btn btn-danger"
                setPlayer(1)
            }
            setCount(count + 1);
            setButtonColor(newBColor);
            setB(newB);
        }

    }

    const reset = () => {
        setWinStr("");
        setDecision(false);
        setB(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
        setPlayer(1);
        setCount(0);
        setButtonColor(["btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark", "btn btn-outline-dark"])
    }

    function onWin() {
        if (count === 9) {
            toast.error(`Match is Draw !!`);
        }
        else {
            if (player === 1) {
                toast.success(`Player 2 is win 🎉🎊🎉`);
                setWinStr("🏆 Player 2 is Win 🏆");
            }
            if (player === 2) {
                toast.success(`Player 1 is win 🎉🎊🎉`);
                setWinStr("🏆 Player 1 is Win 🏆");
            }
        }
    }



    const test = () => {
        if (b[0] === 'x' && b[1] === 'x' && b[2] === 'x') {
            onWin()
        }
        else if (b[0] === 'x' && b[3] === 'x' && b[6] === 'x') {
            onWin()
        }
        else if (b[0] === 'x' && b[4] === 'x' && b[8] === 'x') {
            onWin()
        }
        else if (b[1] === 'x' && b[4] === 'x' && b[7] === 'x') {
            onWin()
        }
        else if (b[2] === 'x' && b[5] === 'x' && b[8] === 'x') {
            onWin()
        }
        else if (b[3] === 'x' && b[4] === 'x' && b[5] === 'x') {
            onWin()
        }
        else if (b[6] === 'x' && b[7] === 'x' && b[8] === 'x') {
            onWin()
        }
        else if (b[2] === 'x' && b[4] === 'x' && b[6] === 'x') {
            onWin()
        }


        else if (b[0] === 'O' && b[1] === 'O' && b[2] === 'O') {
            onWin()
        }
        else if (b[0] === 'O' && b[3] === 'O' && b[6] === 'O') {
            onWin()
        }
        else if (b[0] === 'O' && b[4] === 'O' && b[8] === 'O') {
            onWin()
        }
        else if (b[1] === 'O' && b[4] === 'O' && b[7] === 'O') {
            onWin()
        }
        else if (b[2] === 'O' && b[5] === 'O' && b[8] === 'O') {
            onWin()
        }
        else if (b[3] === 'O' && b[4] === 'O' && b[5] === 'O') {
            onWin()
        }
        else if (b[6] === 'O' && b[7] === 'O' && b[8] === 'O') {
            onWin()
        }
        else if (b[2] === 'O' && b[4] === 'O' && b[6] === 'O') {
            onWin()
        }
        else if (count === 9) {
            onWin()
        }
    }

    const onDecision = (event) => {
        //setPlay(event.target.value)
        event.preventDefault();
        let play = event.target.value;
        console.log(play);
        if (play === "yes") {
            setDecision(true);
            console.log(play, decision);
        }
        else if (play === "no") {
            toast.warning("You will be navigate to Home Page.")
            new Promise(resolve => setTimeout(resolve, 2000)).then(r => {
                // do something
                navigate(Constants.DB_WORLD_HOME_ROUTE);
            })


        }
    }

    if (decision) {
        var decisionStr = "You select Yes"

        decisionStr = <div>
            <div className="card-header">
                <span style={{ fontSize: "24px" }}><b>- Tic Tac Toe</b></span>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                    reset()
                }} style={{ float: "right" }}>Refresh</button>
            </div>
            <div className="card-body text-center">
                {!winStr && <>
                    <div className="card-title">
                        {player===1 && <h3 className="text-primary">Player {player} input</h3> 
                        || <h3 className="text-danger">Player {player} input</h3> }
                    </div>
                </>
                    || <><div className="card-title text-success "><h1>{winStr}</h1></div></>}

                <hr />
                <table className="table table-hover text-center mx-auto" style={{ width: "200px", background: "rgba(30,30,30,0.7)" }}>
                    <tbody>
                        <tr >
                            <td ><button type="button" className={buttonColor[0]} value={b[0]} onClick={onSelection}>{b[0]}</button></td>
                            <td ><button type="button" className={buttonColor[1]} value={b[1]} onClick={onSelection}>{b[1]}</button></td>
                            <td ><button type="button" className={buttonColor[2]} value={b[2]} onClick={onSelection}>{b[2]}</button></td>
                        </tr>
                        <tr >
                            <td ><button type="button" className={buttonColor[3]} value={b[3]} onClick={onSelection}>{b[3]}</button></td>
                            <td ><button type="button" className={buttonColor[4]} value={b[4]} onClick={onSelection}>{b[4]}</button></td>
                            <td ><button type="button" className={buttonColor[5]} value={b[5]} onClick={onSelection}>{b[5]}</button></td>
                        </tr>
                        <tr >
                            <td ><button type="button" className={buttonColor[6]} value={b[6]} onClick={onSelection}>{b[6]}</button></td>
                            <td ><button type="button" className={buttonColor[7]} value={b[7]} onClick={onSelection}>{b[7]}</button></td>
                            <td ><button type="button" className={buttonColor[8]} value={b[8]} onClick={onSelection}>{b[8]}</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    }
    else {
        var decisionStr = <div>
            <div className="card-header">
                <h1>- Tic Tac Toe</h1>
            </div>
            <div className="card-body">
                <h5 className="card-title">
                    Here is only one game name - Tic Tac Toe. Do you want to play this game ?
                </h5>
            </div>
            <p className="card-text ms-5">
                <button type="button" className="btn btn-success mx-3 mb-3" value="yes" onClick={onDecision}>Yes</button>
                <button type="button" className="btn btn-danger mx-3 mb-3" value="no" onClick={onDecision}>No</button>
            </p>
        </div>
    }


    return (
        <div className="card text-dark mx-3 my-3" style={{ background: "rgba(255,255,255,0.9)" }}>
            {decisionStr}
            {Constants.TOAST_CONTAINER}
        </div>
    )
}

export default TicTacToe;