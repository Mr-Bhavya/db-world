import React, { useEffect, useState } from 'react'
import Cover from '../../cover'
import Navbar from '../../navbar'
import TilesRow from '../../tilesRow'
import requests from '../../services/requests'

export default function SeriesPage() {

  const [selectedProfile, setSelectedProfile] = useState({})

  useEffect(() => {

    async function getSelectedProfile() {
      // retreiving selectedProfile to highlight profile icon in navbar
      const selectedProfile = await localStorage.getItem('selectedProfile');
      setSelectedProfile(JSON.parse(selectedProfile));
    };
    getSelectedProfile();

  }, [])
  return (
    <div className='container-main-page'>

      {/* navbar */}
      <Navbar selectedProfile={selectedProfile} />

      {/* cover */}
      <Cover />

      {/* resuable component tile */}
      <div style={{ paddingTop: 16, }}>
        {/* passing special prop topRow for as top row is rendered differently in terms of size and design */}
        <TilesRow title="Newly Added shows" requestUrl={requests.fetchAllSeries} horizontal={true} />
        {/* Rest of the tiles */}
        <TilesRow title="Bollywood" requestUrl={requests.fetchBollywoodSeries} />
        <TilesRow title="Hollywood" requestUrl={requests.fetchHollywoodSeries} />
        <TilesRow title="South" requestUrl={requests.fetchSouthSeries} />
        <TilesRow title="Gujarati" requestUrl={requests.fetchGujaratiSeries} />
        <TilesRow title="K-Drama" requestUrl={requests.fetchKoreanSeries} />
      </div>
    </div>
  )
}
