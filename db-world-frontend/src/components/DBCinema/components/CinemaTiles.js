import requests from "../services/requests";

export const CINEMA_PAGE_TILES = {
    BROWSE: [
    { title: "Newly Added Movies & TV Shows", requestUrl: requests.fetchNewlyAdded, recordTypes: ["movie", "series"]  },
    { title: "Movies", requestUrl: requests.fetchAllMovies, horizontal: true, recordTypes: ["movie", "series"] },
    { title: "TV Shows", requestUrl: requests.fetchAllSeries, horizontal: true, recordTypes: ["movie", "series"] },
    { title: "My List", requestUrl: requests.fetchWatchlist, recordTypes: ["movie", "series"] },
    { title: "Bollywood", requestUrl: requests.fetchBollywoodRecords, recordTypes: ["movie", "series"] },
    { title: "Hollywood", requestUrl: requests.fetchHollywoodRecords, recordTypes: ["movie", "series"] },
    { title: "South", requestUrl: requests.fetchSouthRecord, recordTypes: ["movie", "series"] },
    { title: "Gujarati", requestUrl: requests.fetchGujaratiRecords, recordTypes: ["movie", "series"] },
    { title: "K-Drama", requestUrl: requests.fetchKoreanRecords, recordTypes: ["movie", "series"] }
  ],
  MOVIES: [
    { title: "Newly Added", requestUrl: requests.fetchAllMovies, horizontal: true, recordTypes: ['movie'] },
    { title: "Bollywood", requestUrl: requests.fetchBollywoodMovies, recordTypes: ['movie'] },
    { title: "Hollywood", requestUrl: requests.fetchHollywoodMovies, recordTypes: ['movie'] },
    { title: "South", requestUrl: requests.fetchSouthMovies, recordTypes: ['movie'] },
    { title: "Gujarati", requestUrl: requests.fetchGujaratiMovies, recordTypes: ['movie'] },
    { title: "K-Drama", requestUrl: requests.fetchKoreanMovies, recordTypes: ['movie'] }
  ],
  SERIES: [
    { title: "Newly Added", requestUrl: requests.fetchAllSeries, horizontal: true, recordTypes: ['series'] },
    { title: "Bollywood", requestUrl: requests.fetchBollywoodSeries, recordTypes: ['series'] },
    { title: "Hollywood", requestUrl: requests.fetchHollywoodSeries, recordTypes: ['series'] },
    { title: "South", requestUrl: requests.fetchSouthSeries, recordTypes: ['series'] },
    { title: "Gujarati", requestUrl: requests.fetchGujaratiSeries, recordTypes: ['series'] },
    { title: "K-Drama", requestUrl: requests.fetchKoreanSeries, recordTypes: ['series'] }
  ],
  MINIMAL: [
    { title: "Featured", requestUrl: requests.fetchNewlyAdded },
    { title: "My List", requestUrl: requests.fetchWatchlist }
  ],
  KIDS: [
    { title: "Kids Content", requestUrl: requests.fetchKidsContent },
    { title: "Cartoons", requestUrl: requests.fetchCartoons },
    { title: "Educational", requestUrl: requests.fetchEducational }
  ]
};