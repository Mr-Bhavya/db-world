import React from 'react';
import { BrowserRouter as Router, Switch, Link, Route, useNavigate } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { useEffect } from 'react';
import { useState } from 'react';
import Constants from './Constants';

const Home = () => {

    // useEffect(() => {
    //     localStorage.setItem('login', false);
    //     localStorage.setItem('user', null);
    // }, [])

    const navigate = useNavigate();

    const [cardDetails, setCardDetails] = useState([{
        id: "db-weather",
        image: "https://img.icons8.com/clouds/500/null/apple-weather.png",
        title: "DB Weather",
        route: Constants.DB_WEATHER_ROUTE,
        text: <div>It will show weather information from <b>city</b> name and <b>area pincode</b>. It will also show <b>location on google map</b>.</div>
    },
    {
        id: "db-password-manager",
        image: "https://img.icons8.com/clouds/500/null/password-window.png",
        title: "DB Password Manager",
        route: Constants.DB_PASSWORD_MANAGER_ROUTE,
    },
    {
        id: "db-cinema",
        image: "https://img.icons8.com/clouds/500/null/movies-portal.png",
        title: "DB Cinema",
        route: Constants.DB_MOVIES_ROUTE,
    },
    {
        id: "db-games",
        image: "https://img.icons8.com/external-others-inmotus-design/500/null/external-Tic-Tac-Toe-round-icons-others-inmotus-design-7.png",
        title: "DB Games",
        route: Constants.DB_GAMES_ROUTE,
    }
    ]);

    const mouseEnterEvent = (cardId) => {
        let card = document.getElementById(cardId);
        card.className = "shadow p-3 bg-secondary bg-gradient rounded-3 "
        card.style.cursor = "pointer"
    }

    const mouseLeaveEvent = (cardId) => {
        let card = document.getElementById(cardId);
        card.className = "";
        card.style.cursor = "auto"
    }

    const onClickEvent = (card) => {
        document.title = card.title
        navigate(card.route);
    }

    return (
        <div className="alert alert-light" role="alert" style={{
            border: "5px groove black", margin: "5% 5% 1% 5%", color: "black", background: "rgba(255 ,255 ,255, 0.9)" 
        }}>
            <h1 className="alert-heading text-center"><u>Welcome To DB World</u></h1>
            <hr />

            <Row xs={2} md={4} className="g-3 m-1">
                {cardDetails.map((card, idx) => (
                    <Col
                        id={card.id}
                        onMouseEnter={() => mouseEnterEvent(card.id)}
                        onMouseLeave={() => mouseLeaveEvent(card.id)}
                        onClick={() => onClickEvent(card)}
                    >
                        <Card className='bg-transparent rounded-3 border-dark'>
                            <Card.Img className='border-bottom border-dark roundrd-3' variant="top" src={card.image} />
                            <Card.Body className="bg-light rounded-3">
                                <Card.Text className='text-center'><b>{card.title}</b></Card.Text>
                                {/* <Card.Text>{card.text}</Card.Text> */}
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* <p style={{ fontSize: "28px" }}>
                You are new on DBMovies ?<br />
                <Link to="/registration"><button className="btn btn-primary">Create Account 📃</button></Link>
            </p>
            <hr />
            <p style={{ fontSize: "28px" }}>
                If you already registered on DBMovies<br />
                <Link to="/login"><button className="btn btn-success">Login 🔐</button></Link> here
            </p> */}

        </div>
    )
}

export default Home;