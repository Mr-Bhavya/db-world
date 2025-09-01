import React, { useCallback, useEffect, useState, useRef } from "react";
import "./ImageCard.css";
import Constants from "../../Constants";
import ModalPortal from "./ModalProtal";
import RecordPreviewModal from "./RecordPreviewModal";
import LazyImage from "../components/LazyImage";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import CommonServices from "../../CommonServices";
import useRecordStore from "../../../store/recordStore";
import { loadDbCinemaRecordsFromUrl } from "../../ApiServices";

const ImageCardItem = ({ record, horizontal }) => {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    // Compute the image URL only once per record
    const url = CommonServices.getImageUrlFromTmdb(
      record?.tmdb,
      horizontal ? Constants.IMAGE_TYPE_BACKDROP : Constants.IMAGE_TYPE_POSTER,
      "w500"
    );
    setImageUrl(url);
  }, [record, horizontal]);

  const handleError = () => {
    let imagePath = !horizontal ? record?.tmdb.poster_path : record?.tmdb.backdrop_path;
    setImageUrl(
      Constants.TMDB_IMAGE_BASE_URL
        .replace('{quality}', 'w500')
        .replace('{imagePath}', imagePath)
    )
  };

  return (
    <div className="card bg-dark text-white">
      <LazyImage
        key={record.id}
        className={`thumbnail ${horizontal ? "horizontal" : ""} card-img`}
        skeleton={
          <div className="item-container">
            <div className={`skeleton-card ${horizontal ? "horizontal" : ""}`}></div>
          </div>
        }
        src={imageUrl}
        alt={record.title}
        horizontal={horizontal}
        handleError={handleError}
      />
      {horizontal && (
        <div className="card-img-overlay d-flex align-items-end m-0 p-0">
          <p className="card-title text-sm m-0 p-0">{record?.name}</p>
        </div>
      )}
    </div>
  );
};

const ImageCard = ({ title, horizontal, requestUrl, category }) => {
  const { records: allRecords, addRecords, updateRecord } = useRecordStore();
  const [activeRecord, setActiveRecord] = useState(null);
  const [recordIds, setRecordIds] = useState([]);
  const [records, setRecords] = useState(recordIds.map(id => allRecords[id]).filter(Boolean));
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(null);

  const [loading, setLoading] = useState(false);
  const [modalPosition, setModalPosition] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const scrollContainerRef = useRef(null);
  const hoverTimeout = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isMobile = window.innerWidth <= 768;

  // Check if an element is fully visible within a container.
  const isElementFullyVisible = (element, container) => {
    if (!element || !container) return false;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;
  };

  // Fetch records with pagination.
  const fetchRecords = useCallback(async (page) => {
    setLoading(true);
    try {
      const response = await loadDbCinemaRecordsFromUrl(requestUrl, {
        page, size: isMobile ? 8 : 12, genres: category?.id
      });      
      const data = response.data;
      if (data?.records) {
        const mappedRecords = data.records.map(record => ({
          ...record,
          tmdb: record.type === Constants.RECORD_TYPE_MOVIE
            ? record.movieTmdb
            : record.seriesTmdb
        }));
        setRecordIds(prev => Array.from(
          new Map([...prev, ...mappedRecords.map(record => record.recordId)].map(id => [id, id])).values()
        ));
        addRecords(mappedRecords);
        setTotalPages(data.totalElements);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching records:", error);
    }
    setLoading(false);
  }, [requestUrl, isMobile, category]);

  // Handle horizontal scroll (infinite scroll) and update scrolling state.
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading) return;

    // Set scrolling flag
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 500);

    const { scrollWidth, scrollLeft, clientWidth } = container;
    if (scrollWidth - scrollLeft - clientWidth < 200 && currentPage < totalPages) {
      fetchRecords(currentPage + 1);
    }
  }, [loading, currentPage, totalPages, fetchRecords]);

  // Scroll left/right handlers for the arrow icons.
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

  // Open modal with a delay (only if not scrolling).
  const handleInteractionStart = (record, e) => {
    setActiveRecord(null);
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    if (e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setModalPosition({
        top: rect.top + 100,
        left: rect.left - 150,
        width: rect.width + 300,
        height: rect.height,
      });
    }
    isMobile ? setActiveRecord(record) :
      hoverTimeout.current = setTimeout(() => {
        setActiveRecord(record);
      }, 1000);
  };

  // Close modal with a slight delay.
  const handleInteractionEnd = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    hoverTimeout.current = setTimeout(() => {
      setActiveRecord(null);
    }, 300);
  };

  const handleCloseMobileModal = () => {
    setActiveRecord(null);
  };

  // Prevent background scroll when mobile modal is open.
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

  useEffect(() => {
    // Update records whenever recordIds or allRecords change
    setRecords(recordIds.map(id => allRecords[id]).filter(Boolean));
  }, [recordIds, allRecords]);

  // Initial fetch on component mount.
  useEffect(() => {
    fetchRecords(currentPage);
  }, [fetchRecords, currentPage, category]);

  return (
    <div className="horizontal-scroll-wrapper">
      <div className="scroll-container" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="items-wrapper">
          {records?.map((record) => (
            title === "My List" && record.isWatchListed === false ? null :
              <div
                key={record?.recordId}
                className={`item-container ${activeRecord?.recordId === record?.recordId ? 'active' : ''}`}
                onMouseEnter={(e) => {
                  if (!isMobile && !isScrolling && isElementFullyVisible(e.currentTarget, scrollContainerRef.current)) {
                    handleInteractionStart(record, e);
                  }
                }}
                onMouseLeave={!isMobile ? handleInteractionEnd : undefined}
                onClick={(e) => {
                  if (isMobile && !isScrolling) {
                    handleInteractionStart(record, e);
                  }
                }}
              >
                <ImageCardItem record={record} horizontal={horizontal} />
              </div>
          ))}

          {/* Skeleton placeholders while loading */}
          {loading && (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="item-container">
                <div className={`skeleton-card ${horizontal ? 'horizontal' : ''}`}></div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scroll Icons (only for desktop) */}
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

      {/* Desktop Modal with Transition */}
      {!isMobile && (
        <ModalPortal>
          <TransitionGroup component={null}>
            {activeRecord && (
              <CSSTransition
                key={activeRecord.recordId}
                timeout={300}
                classNames="modal"
                unmountOnExit
              >
                <div
                  className="desktop-modal-overlay"
                  style={{
                    position: "fixed",
                    top: modalPosition?.top || 0,
                    left: modalPosition?.left || 0,
                    width: modalPosition?.width || "auto",
                    height: modalPosition?.height || "auto",
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
              </CSSTransition>
            )}
          </TransitionGroup>
        </ModalPortal>
      )}

      {/* Mobile Modal with Transition */}
      {isMobile && (
        <TransitionGroup component={null}>
          {activeRecord && (
            <CSSTransition
              key={activeRecord.recordId}
              timeout={300}
              classNames="modal"
              unmountOnExit
            >
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
            </CSSTransition>
          )}
        </TransitionGroup>
      )}
    </div>
  );
};

export default ImageCard;