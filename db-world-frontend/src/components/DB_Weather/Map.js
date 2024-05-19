import React, { useEffect, useState } from "react";
import L from "leaflet";

export default function Map(props) {
  const defaultProps = {
    center: {
      lat: props.lat,
      lng: props.lon
    },
    zoom: 11
  };

  const [coordinates, setCoordinates] = useState({ lat: defaultProps.center.lat, lng: defaultProps.center.lng });
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    const map = L.map("map").setView(coordinates, zoom);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.marker([defaultProps.center.lat, defaultProps.center.lng]).addTo(map)
      .bindPopup('Youe are here')
      .openPopup();

    return () => map.remove();
  }, [coordinates, zoom]);

  return (
    // Important! Always set the container height explicitly
    <div>
      <u><h3 className="text-center">🗺️ Location On Map 🗺️ </h3></u>
      <div className="d-flex align-items-center justify-content-center flex-warp m-5">
        <div style={{ height: "20rem", width: "50rem", background: "rgba(255 ,255 ,255, 0.9)" }} id="map" />
      </div>


    </div>
  );
}