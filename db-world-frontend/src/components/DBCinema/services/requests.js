// const API_KEY = "3058f11e9fc63d81c4bf1d973374e695";
const requests = {
    //Home Screen
    fetchAllRecords: `/api/cinema/record?`,
    fetchSouthRecord: `/api/cinema/record?languages=ta,te,ml,kn`,
    fetchBollywoodRecords: `/api/cinema/record?languages=hi`,
    fetchHollywoodRecords: `/api/cinema/record?languages=en`,
    fetchGujaratiRecords: `/api/cinema/record?languages=gu`,
    fetchKoreanRecords: `/api/cinema/record?languages=ko`,

    
    //Movie Screen
    fetchAllMovies: `/api/cinema/record/type/movie?`,
    fetchSouthMovies: `/api/cinema/record/type/movie?languages=ta,te,ml,kn`,
    fetchBollywoodMovies: `/api/cinema/record/type/movie?languages=hi`,
    fetchHollywoodMovies: `/api/cinema/record/type/movie?languages=en`,
    fetchGujaratiMovies: `/api/cinema/record/type/movie?languages=gu`,
    fetchKoreanMovies: `/api/cinema/record/type/movie?languages=ko`,

    //Series Screen
    fetchAllSeries: `/api/cinema/record/type/series?`,
    fetchSouthSeries: `/api/cinema/record/type/series?languages=ta,te,ml,kn`,
    fetchBollywoodSeries: `/api/cinema/record/type/series?languages=hi`,
    fetchHollywoodSeries: `/api/cinema/record/type/series?languages=en`,
    fetchGujaratiSeries: `/api/cinema/record/type/series?languages=gu`,
    fetchKoreanSeries: `/api/cinema/record/type/series?languages=ko`,

    fetchWatchlist: `/api/cinema/watchlist?`,
    fetchNewlyAdded: `/api/cinema/record?`,
    fetchCoverRecord: `/api/cinema/record/cover`
    
    // fetchTopRated: `/movie/top_rated?api_key=${API_KEY}&language=en-US`,
    // fetchPopular: `/movie/popular?api_key=${API_KEY}&language=en-US`,
    // fetchTVShows:`tv/popular?api_key=${API_KEY}&language=en-US&page=1`,

    // fetchComedy:`discover/movie?api_key=${API_KEY}&with_genres=35`,
    // fetchAction:`discover/movie?api_key=${API_KEY}&with_genres=28`,
    // fetchDocumentaries:`discover/movie?api_key=${API_KEY}&with_genres=99`,
    // fetchHorror:`discover/movie?api_key=${API_KEY}&with_genres=27`,
    
}

export default requests;