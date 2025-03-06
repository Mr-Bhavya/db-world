import React, { useEffect, useState } from 'react'
import './index.css'
import Cover from '../../cover'
import Navbar from '../../navbar'
import TilesRow from '../../tilesRow'
import requests from '../../services/requests'

export default function MainPage() {

  return (
    <div className='container-main-page'>

      {/* cover */}
      <Cover />


      {/* navbar */}
      <Navbar />

      {/* resuable component tile */}
      <div style={{ paddingTop: 16, }}>
        {/* passing special prop topRow for as top row is rendered differently in terms of size and design */}
        <TilesRow title="Newly Added Movies & TV Shows" requestUrl={requests.fetchNewlyAdded} />

        {/* Rest of the tiles */}
        <TilesRow title="Movies" requestUrl={requests.fetchAllMovies} horizontal={true} />
        <TilesRow title="TV Shows" requestUrl={requests.fetchAllSeries} horizontal={true} />

        <TilesRow title="My List" requestUrl={requests.fetchWatchlist} />

        <TilesRow title="Bollywood" requestUrl={requests.fetchBollywoodRecords} />
        <TilesRow title="Hollywood" requestUrl={requests.fetchHollywoodRecords} />
        <TilesRow title="South" requestUrl={requests.fetchSouthRecord} />
        <TilesRow title="Gujarati" requestUrl={requests.fetchGujaratiRecords} />
        <TilesRow title="K-Drama" requestUrl={requests.fetchKoreanRecords}/>

        {/* <RowPost title="Movies" url={requests.fetchTopRated} />
        <RowPost title="Movies" url={requests.fetchPopular} />
        <RowPost title="Movies" url={requests.fetchTVShows} />
        <RowPost title="Movies" url={requests.fetchComedy} />
        <RowPost title="Movies" url={requests.fetchAction} />
        <RowPost title="Movies" url={requests.fetchDocumentaries} />
        <RowPost title="Movies" url={requests.fetchHorror} /> */}

      </div>
    </div>
  )
}
