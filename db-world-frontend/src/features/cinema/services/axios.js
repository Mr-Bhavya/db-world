import axios from "axios";
const REACT_APP_BASEURL = import.meta.env.VITE_API_BASE_URL || '';

const networkService = axios.create({
    baseURL: REACT_APP_BASEURL,
    headers: {
        Authorization: 'Bearer ' + localStorage.getItem("token")
    }
});

export const imageBaseUrl = "https://image.tmdb.org/t/p/w500/";

export default networkService;