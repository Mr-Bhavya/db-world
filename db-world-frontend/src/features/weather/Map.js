import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box } from "@mui/material";
import { motion } from "framer-motion";

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Map(props) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    mapInstance.current = L.map(mapRef.current).setView(
      [props.lat, props.lon],
      13
    );

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapInstance.current);

    // Add custom icon
    const customIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add marker
    markerRef.current = L.marker([props.lat, props.lon], { icon: customIcon })
      .addTo(mapInstance.current)
      .bindPopup(`<b>${props.name}</b><br>Your current location`)
      .openPopup();

    // Cleanup function
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, [props.lat, props.lon, props.name]);

  // Update map view when props change
  useEffect(() => {
    if (mapInstance.current && markerRef.current) {
      const newLatLng = new L.LatLng(props.lat, props.lon);
      mapInstance.current.setView(newLatLng, 13);
      markerRef.current.setLatLng(newLatLng);
    }
  }, [props.lat, props.lon]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          height: 400,
          width: "100%",
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: 3,
          border: "1px solid rgba(13,148,136,0.4)"
        }}
      >
        <div
          ref={mapRef}
          style={{
            height: "100%",
            width: "100%",
            borderRadius: "inherit"
          }}
        />
      </Box>
    </motion.div>
  );
}