import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import "./navbar.css";
import useWindowSize from '../utils/hooks/useWindowSize';
import Constants from '../../Constants';
import SearchOverlay from '../screens/search';
import Cover from '../cover';

function Navbar() {
  const arrOptions = [
    { id: 1, title: "Home", route: Constants.DB_CINEMA_BROWSE_ROUTE },
    { id: 2, title: "Movies", route: Constants.DB_CINEMA_MOVIES_ROUTE },
    { id: 3, title: "TV Shows", route: Constants.DB_CINEMA_SERIES_ROUTE },
    // { id: 4, title: "My List", route: "/my-list" }
  ];

  const navigate = useNavigate();
  const screenSize = useWindowSize();
  const [offset, setOffset] = useState(0);
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    const onScroll = () => setOffset(window.pageYOffset);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className={`container-navbar ${offset > 30 ? "after-scroll" : ""}`}>
        {/* Left Section: Logo */}
        <div className="left-section">
          <Link to={Constants.DB_WORLD_HOME_ROUTE} style={{ paddingLeft: 16 }}>
            <img
              className="netflix-logo"
              src="https://db-world.in/static/media/db_world_teal.0e35515b2b6f8921003029df632aab7f.svg"
              alt="Logo"
            />
          </Link>
        </div>

        {/* Center Section: Navigation Links */}
        <div className="cinema-nav-center">
          {screenSize.width > 0 &&
            arrOptions.map((element) => (
              <NavLink
                key={element.id}
                to={element.route}
                className={({ isActive }) =>
                  isActive ? "cinema-nav-link active" : "cinema-nav-link"
                }
                style={{ paddingLeft: 16 }}
              >
                {element.title}
              </NavLink>
            ))
          }
        </div>

        {/* Right Section: Search Icon */}
        <div className="right-section">
          <div
            onClick={() => setSearchActive(true)}
            style={{ color: '#fff', fontSize: 20, cursor: 'pointer', margin: "auto" }}
          >
            <i className="fa fa-search"></i>
          </div>
        </div>
      </div>

      {/* Render the Search Overlay when active */}
      {searchActive && <SearchOverlay onClose={() => setSearchActive(false)} />}
    </>
  );
}


export default Navbar;
