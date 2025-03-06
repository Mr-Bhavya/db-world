import React, { useCallback, useEffect, useState, useRef } from "react";
import axios from "../services/axios";
import "./PreviewModal.css";
import Constants from "../../Constants";
import ModalPortal from "./ModalProtal";
import RecordPreviewModal from "./RecordPreviewModal";

const ImageCard = ({ title, horizontal, requestUrl }) => {
  const [activeRecord, setActiveRecord] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState('');
  const [records, setRecords] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef(null);
  const hoverTimeout = useRef(null);
  const [modalPosition, setModalPosition] = useState(null);
  const isMobile = window.innerWidth <= 768;

  // Helper: Check if an element is fully visible within a container.
  const isElementFullyVisible = (element, container) => {
    if (!element || !container) return false;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // Check that the entire element is within the container's horizontal bounds.
    return elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;
  };

  // Fetch records with pagination
  const fetchRecords = useCallback(async (page) => {
    setLoading(true);
    try {
      const response = await axios.get(`${requestUrl}&page=${page}&size=${isMobile ? 8 : 12}`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem("token") }
      });
      const data = response.data?.data;
      if (data?.records) {
        const mappedRecords = data.records.map(record => ({
          ...record,
          tmdb: record.type === Constants.RECORD_TYPE_MOVIE
            ? record.movieTmdb
            : record.seriesTmdb
        }));
        setRecords((prev) => Array.from(
          new Map([...prev, ...mappedRecords].map((record) => [record.recordId, record])).values()
        ));
        setTotalPages(data.totalElements);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching records:", error);
    }
    setLoading(false);
  }, [requestUrl]);

  // Handle horizontal scroll (infinite scroll)
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading) return;
    const { scrollWidth, scrollLeft, clientWidth } = container;
    if (scrollWidth - scrollLeft - clientWidth < 200 && currentPage < totalPages) {
      fetchRecords(currentPage + 1);
    }
  }, [loading, currentPage, totalPages, fetchRecords]);

  // Scroll left/right handlers for the arrow icons
  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -700, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 700, behavior: "smooth" });
    }
  };

  // Event handlers for opening the modal.
  // (Only open if the element is fully visible.)
  const handleInteractionStart = (record, e) => {
    clearTimeout(hoverTimeout.current);
    setActiveRecord(record);
    if (e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      // Save the hovered element's position (viewport coordinates)
      setModalPosition({
        top: rect.top + 100,
        left: rect.left - 150,
        width: rect.width + 300,
        height: rect.height,
      });
    }
  };

  const handleInteractionEnd = () => {
    hoverTimeout.current = setTimeout(() => {
      setActiveRecord(null);
      setTrailerUrl('');
    }, 300);
  };

  const handleCloseMobileModal = () => {
    setActiveRecord(null);
    setTrailerUrl('');
  };

  // Prevent background scroll when mobile modal is open
  useEffect(() => {
    if (activeRecord) {
      document.body.style.overflowY = 'hidden';
      document.body.style.overflowX = 'auto';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [activeRecord]);

  // Initial fetch
  useEffect(() => {
    fetchRecords(currentPage);
  }, []);

  // Function passed to child components to update record data.
  const updateRecord = (updatedRecord) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.recordId === updatedRecord.recordId ? updatedRecord : r
      )
    );
    if (activeRecord && activeRecord.recordId === updatedRecord.recordId) {
      setActiveRecord(updatedRecord);
    }
  };

  return (
    // Each horizontal scroll area is wrapped in its own container.
    <div className="horizontal-scroll-wrapper">
      <div className="scroll-container" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="items-wrapper">
          {records?.map((record) => (
            title === "My List" && record.isWatchListed === false ? "" : 
              <div
                key={record?.recordId}
                className={`item-container ${activeRecord?.recordId === record?.recordId ? 'active' : ''}`}
                onMouseEnter={(e) => {
                  if (!isMobile && isElementFullyVisible(e.currentTarget, scrollContainerRef.current)) {
                    handleInteractionStart(record, e);
                  }
                }}
                onMouseLeave={!isMobile ? handleInteractionEnd : undefined}
                onClick={(e) => {
                  if (isMobile) {
                    handleInteractionStart(record, e);
                  }
                }}
              >
                <div class="card bg-dark text-white">
                  <img src={`https://image.tmdb.org/t/p/original${horizontal
                    ? record?.tmdb?.backdrop_path || record?.tmdb?.poster_path
                    : record?.tmdb?.poster_path
                    }`}
                    alt={record?.title} className={`thumbnail ${horizontal ? 'horizontal' : ''} card-img`} loading="lazy" />

                  {horizontal && <div className="card-img-overlay d-flex align-items-end m-0 p-0">
                    <p class="card-title text-sm m-0 p-0">{record?.name}</p>
                  </div>}
                </div>
              </div>
          ))}

          {/* Append Skeleton Placeholders while loading */}
          {loading && (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="item-container">
                <div className={`skeleton-card ${horizontal ? 'horizontal' : ''}`}></div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scroll Icons (only visible when hovering over this wrapper) */}
      {!isMobile && (
        <>
          <div className="scroll-icon scroll-left" onClick={handleScrollLeft}>
            &#8249;
          </div>
          <div className="scroll-icon scroll-right" onClick={handleScrollRight}>
            &#8250;
          </div>
        </>
      )}

      {/* Desktop Modal */}
      {(activeRecord && !isMobile) && (
        <ModalPortal>
          <div
            className="desktop-modal-overlay"
            style={{
              position: "fixed",
              top: modalPosition.top,
              left: modalPosition.left,
              width: modalPosition.width,
              height: modalPosition.height,
              zIndex: 1000,
            }}
            onMouseEnter={() => clearTimeout(hoverTimeout.current)}
            onMouseLeave={handleInteractionEnd}
          >
            <div className="desktop-modal">
              <RecordPreviewModal
                title={title}
                record={activeRecord}
                onClose={handleInteractionEnd}
                onUpdateRecord={updateRecord}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Mobile Modal */}
      {(activeRecord && isMobile) && (
        <div
          className="mobile-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseMobileModal();
            }
          }}
        >
          <div className="mobile-modal">
            <RecordPreviewModal
              title={title}
              record={activeRecord}
              onClose={handleCloseMobileModal}
              onUpdateRecord={updateRecord}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageCard;
