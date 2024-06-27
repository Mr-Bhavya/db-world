import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Authentication from '../Authentication';
import Constants from '../Constants';
import CommonServices from '../CommonServices';
import Map from './Map';


function Weather() {
    const [weatherData, setweatherData] = useState();
    const [city, setCity] = useState("Pune");
    // const [coords, setCoords] = useState({ latitude: null, longitude: null });
    const navigate = useNavigate();
    const [loader, setLoader] = useState(true);

    const getWeatherFromCity = async () => {
        setLoader(true);
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=5ac693a87e8bebb7c7b40655e85dde50`);
            const data = await res.json();
            console.log(data);
            if (res.status === 200) {
                setweatherData(data);
            }
            else {
                toast.error("City Not Found");
            }
        } catch (err) {
            toast.error("failed to get weather report.")
        }
        setLoader(false);
    }

    const getWeatherFromCoords = async (coords) => {
        setLoader(true);
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=5ac693a87e8bebb7c7b40655e85dde50`);
            const data = await res.json();
            console.log(data);
            if (res.status === 200) {
                setweatherData(data);
            }
            else {
                toast.error("Location not Found");
            }
        } catch (err) {
            // console.log("failed to get weather data")
            toast.error("failed to get weather report.")
        }
        setLoader(false);
    }

    const getGeoLocationDetails = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    getWeatherFromCoords(position.coords);
                },
                error => {
                    if (error && error.code && error.code === 1) {
                        console.log(error.message || "User denided permission")
                    }
                    else {
                        console.log(error);
                    }
                    toast.error("failed to get current location.")
                    getWeatherFromCity();
                }
            )
        } else {
            toast.error("failed to get current location.")
            getWeatherFromCity();
        }
        console.log(navigator.userAgent);
        // const response = await fetch(
        //     `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
        // );
        // const data = await response.json();
        // const city = data.address.town || data.address.city || data.address.county;
        // setCity(data.address.town || data.address.city || data.address.county);
        // console.log(data);
    }

    useEffect(() => {
        CommonServices.valiadteToken().then(async isValidToken => {
            if (isValidToken) {
                let authenticationRes = Authentication({ redirectTo: Constants.DB_WEATHER_ROUTE });
                if (authenticationRes.login) {
                    getGeoLocationDetails();
                } else {
                    navigate(authenticationRes.redirectUrl);
                }
            }
        }).catch(err => {
            console.log(err);
        });
    }, [])

    // const onCitySubmit = () => {
    //     getWeatherFromCity();
    // }

    // Authrize();

    return (

        <div className="card m-1" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
            <div className="row g-0">
                <div className="col-md-6">
                    <h1 className="card-title col-md-5 mt-3 ms-3 mb-3">Weather Information</h1>
                </div>
                <div className="col-md-6">
                    <br />
                    <h6 className="card-title col-md-5 ms-3 mb-3">Do you want to change city ?</h6>

                    <div className="card-title col-md-5 ms-3">
                        <span> Enter a city / pincode: <input type="text" name="city" placeholder="411032" style={{ width: "35%" }} onChange={(e) => setCity(e.target.value)} /></span>
                        <button type="submit" className="btn btn-danger btn-sm ms-2" onClick={getWeatherFromCity}>🔍</button>
                    </div>
                </div>
                <hr />
                <p className='text-danger mx-3'><b>*Note: </b>To get current location details, please allow location permission.</p>
                {
                    loader &&
                    <div className='d-flex justify-content-center'>
                        <div className="spinner-border text-danger m-5" role="status">
                            <span className="sr-only text-center"></span>
                        </div>
                    </div>
                    ||
                    <>
                        <div className="col-md-5 ms-3 mb-3">
                            {/* <button type="submit" className="btn btn-info btn-sm ms-3 me-3 " onClick={onCitySubmit} >Refresh Data</button> */}
                            <button type="submit" className="btn btn-info btn-sm ms-3 me-3 " onClick={getGeoLocationDetails} >Get current location details</button>
                            <h3 className="display-5 mt-3">Location 📍</h3>
                            <h3 className="display-5 ">{weatherData.name} - {weatherData.sys.country}</h3>
                            <span style={{ float: "left" }}><img src={`https://openweathermap.org/img/w/${weatherData.weather[0].icon}.png`} className="img-fluid rounded-start mt-3 me-3" alt="No Photo" /></span>
                            <h3 className="display-5 ms-3 mt-3">{weatherData.weather[0].main}</h3>
                            <br />
                            <h6 >Today's Date: {CommonServices.getTimeDateFromTimeStamp(weatherData.dt * 1000).date}</h6>
                        </div>
                        <div className="col-md-6">
                            <div className="card-body">
                                <div className="table-responsive">
                                    <table className="table align-middle me-5">
                                        <tbody>
                                            <tr>
                                                {/* <td><b>⌚ &nbsp;&nbsp;&nbsp;&nbsp; Current Time</b></td><td>{secToDateTime(weatherData.dt)[1]}</td> */}
                                                <td><b>⌚ &nbsp;&nbsp;&nbsp;&nbsp; Current Time</b></td><td>{CommonServices.getTimeDateFromTimeStamp(weatherData.dt * 1000).time}</td>
                                            </tr>
                                            <tr>
                                                <td><b>🌄 &nbsp;&nbsp;&nbsp;&nbsp; Sunrise Time</b></td><td>{CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunrise * 1000).time}</td>
                                            </tr>
                                            <tr>
                                                <td><b>🌇 &nbsp;&nbsp;&nbsp;&nbsp; Sunset Time</b></td><td>{CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunset * 1000).time}</td>
                                            </tr>
                                            <tr>
                                                <td><b>&nbsp;🌡 &nbsp;&nbsp;&nbsp;&nbsp; Temperature</b></td><td>{(weatherData.main.temp - 273.15).toFixed(2)} ℃</td>
                                            </tr>
                                            <tr>
                                                <td><b>⏲ &nbsp;&nbsp;&nbsp;&nbsp; Pressure</b></td><td>{weatherData.main.pressure}</td>
                                            </tr>
                                            <tr>
                                                <td><b>⚡ &nbsp;&nbsp;&nbsp;&nbsp; Wind Speed</b></td><td>{weatherData.wind.speed} meter/sec</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <hr />
                        <Map
                            lat={weatherData.coord.lat}
                            lon={weatherData.coord.lon}
                            name={weatherData.name}
                        />
                    </>
                }
            </div>
            {Constants.TOAST_CONTAINER}
        </div>
    )
}

export default Weather;