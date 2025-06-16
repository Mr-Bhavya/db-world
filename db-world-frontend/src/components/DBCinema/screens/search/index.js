import React, { useEffect, useState } from 'react';
import { saveUserEventInfo, searchRecord, searchStreamFile } from '../../../ApiServices';
import CommonServices from '../../../CommonServices';
import Constants from '../../../Constants';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import './SearchOverlay.css';
import FileDetailsModal from './FileDetailsModal';

const PAGE_SIZE = 12; // Number of records per page (for record search)

function SearchOverlay({ onClose }) {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // --- Records State (with pagination) ---
  const [records, setRecords] = useState([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [hasMoreRecords, setHasMoreRecords] = useState(true);
  const [isLoadingNextRecords, setIsLoadingNextRecords] = useState(false);
  const [isSearchRecordResDone, setIsSearchRecordResDone] = useState(false);

  // --- Streams State (no pagination) ---
  const [streamList, setStreamList] = useState([]);
  const [isSearchStreamResDone, setIsSearchStreamResDone] = useState(false);

  // --- Tab State ---
  const [activeTab, setActiveTab] = useState('records');

  // --- Modal State for File Details ---
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // --- Helper Functions ---
  // Format file size in B, KB, or MB.
  const formatFileSize = (size) => {
    if (size < 1024) return size + " B";
    else if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    else return (size / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Group stream files by directory (based on filePath).
  const groupByDirectory = (files) => {
    return files.reduce((acc, file) => {
      const lastSlash = file.filePath.lastIndexOf('/');
      const directory = lastSlash !== -1 ? file.filePath.substring(0, lastSlash) : 'Root';
      if (!acc[directory]) acc[directory] = [];
      acc[directory].push(file);
      return acc;
    }, {});
  };

  // --- API Calls per Tab ---
  // Record search uses pagination.
  const searchRecords = async (page = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        // Always reset to page 0 for a new search
        setRecords([]);
        setRecordsPage(0);
        setHasMoreRecords(true);
        setIsSearchRecordResDone(false);
      }
      saveUserEventInfo("SEARCH", term);
      const modifiedQuery = CommonServices.modifySearchQuery(term);
      const recordResponse = await searchRecord(modifiedQuery, page, PAGE_SIZE);
      if (recordResponse.httpStatusCode === 200) {
        const mappedRecords = recordResponse.data.records.map(record => {
          record.tmdb = record.type === Constants.RECORD_TYPE_MOVIE ? record.movieTmdb : record.seriesTmdb;
          return record;
        });
        if (isLoadMore) {
          setRecords(prev => [...prev, ...mappedRecords]);
        } else {
          setRecords(mappedRecords);
        }
        if (mappedRecords.length < PAGE_SIZE) {
          setHasMoreRecords(false);
        }
        setIsSearchRecordResDone(true);
      } else if (recordResponse.httpStatusCode === 401) {
        Constants.showToast.error(recordResponse.message + Constants.RE_LOGIN);
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        Constants.showToast.error(recordResponse.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Stream search now fetches all results in one call (no pagination).
  const searchStreams = async () => {
    try {
      // Reset stream state for a new search
      setStreamList([]);
      setIsSearchStreamResDone(false);
      saveUserEventInfo("SEARCH", term);
      const modifiedQuery = CommonServices.modifySearchQuery(term);
      // Notice we are no longer passing page and PAGE_SIZE parameters here.
      const streamResponse = await searchStreamFile(modifiedQuery);
      if (streamResponse.httpStatusCode === 200) {
        setStreamList(streamResponse.data);
        setIsSearchStreamResDone(true);
      } else if (streamResponse.httpStatusCode === 401) {
        Constants.showToast.error(streamResponse.message + Constants.RE_LOGIN);
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        Constants.showToast.error(streamResponse.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Trigger Search on Term or Tab Change ---
  useEffect(() => {
    if (term.trim() !== '') {
      if (activeTab === 'records') {
        searchRecords(0, false);
      } else if (activeTab === 'stream') {
        searchStreams();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, activeTab]);

  // --- Scroll Handler for Infinite Loading (only for records) ---
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Only apply infinite scroll for records
    if (activeTab === 'records' && scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasMoreRecords && !isLoadingNextRecords) {
        setIsLoadingNextRecords(true);
        searchRecords(recordsPage + 1, true).then(() => {
          setRecordsPage(prev => prev + 1);
          setIsLoadingNextRecords(false);
        });
      }
    }
  };

  // --- Auto-load More if Content is Too Short (only for records) ---
  useEffect(() => {
    const overlay = document.querySelector('.search-overlay');
    if (
      overlay &&
      overlay.scrollHeight <= overlay.clientHeight &&
      term.trim() !== '' &&
      isSearchRecordResDone &&
      activeTab === 'records'
    ) {
      if (hasMoreRecords && !isLoadingNextRecords) {
        setIsLoadingNextRecords(true);
        searchRecords(recordsPage + 1, true).then(() => {
          setRecordsPage(prev => prev + 1);
          setIsLoadingNextRecords(false);
        });
      }
    }
  }, [
    records,
    hasMoreRecords,
    isLoadingNextRecords,
    term,
    activeTab,
    recordsPage,
    isSearchRecordResDone
  ]);

  // --- Modal Handlers ---
  const handleFileClick = (file) => {
    setSelectedFile(file);
    setShowFileModal(true);
  };

  const handleCloseModal = () => {
    setShowFileModal(false);
    setSelectedFile(null);
  };

  return (
    <>
      <div className="search-overlay" onScroll={handleScroll}>
        <div className="search-overlay-header">
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search..."
            autoFocus
          />
          <button className="close-search-btn" onClick={onClose}>X</button>
        </div>

        {/* Tab Header */}
        <div className="tab-header">
          <button
            className={`tab-button ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            Records
          </button>
          <button
            className={`tab-button ${activeTab === 'stream' ? 'active' : ''}`}
            onClick={() => setActiveTab('stream')}
          >
            Stream Files
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'records' ? (
            <div className="search-overlay-results">
              {term ? (
                <div>
                  <p>
                    Showing results for: <strong>{term}</strong>
                  </p>
                  {isSearchRecordResDone ? (
                    <div className="results-container">
                      {records.length > 0 ? (
                        <div className="results-grid">
                          {records.map(record => (
                            <div className="result-item" key={record.id}>
                              <img
                                src={`https://image.tmdb.org/t/p/w500${record.tmdb.poster_path}`}
                                alt={record.name || record.tmdb.title}
                                onClick={() =>
                                  navigate(
                                    record.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
                                      ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(
                                        ":title",
                                        record.recordId +
                                        "-" +
                                        record.name.toLowerCase().replace(/ /g, "-")
                                      )
                                      : Constants.DB_SERIES_DETIALS_ROUTE.replace(
                                        ":title",
                                        record.recordId +
                                        "-" +
                                        record.name.toLowerCase().replace(/ /g, "-")
                                      )
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>No results found.</p>
                      )}
                      {isLoadingNextRecords && (
                        <div className="skeleton-container">
                          {[...Array(PAGE_SIZE)].map((_, index) => (
                            <div className="skeleton-item" key={index}></div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="skeleton-container">
                      {[...Array(PAGE_SIZE)].map((_, index) => (
                        <div className="skeleton-item" key={index}></div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="search-prompt">Type to search...</p>
              )}
            </div>
          ) : (
            <div className="search-overlay-results">
              {term ? (
                <div>
                  <p>
                    Showing results for: <strong>{term}</strong>
                  </p>
                  {isSearchStreamResDone ? (
                    <div className="results-container">
                      {streamList.length > 0 ? (
                        <div className="stream-files">
                          {Object.entries(groupByDirectory(streamList)).map(([directory, files]) => (
                            <div className="directory-group" key={directory}>
                              <h4 className="directory-name">{directory}</h4>
                              <div className="files-grid">
                                {files.map(file => (
                                  <div className="file-item" key={file.fileId} onClick={() => handleFileClick(file)}>
                                    <p className="file-name">{file.fileName}</p>
                                    <p className="file-size">{formatFileSize(file.fileSize)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>No stream files found.</p>
                      )}
                    </div>
                  ) : (
                    // Stream Files Skeleton
                    <div className="stream-files-skeleton">
                      {[...Array(2)].map((_, groupIndex) => (
                        <div className="directory-group-skeleton" key={groupIndex}>
                          <div className="directory-name-skeleton skeleton-animation"></div>
                          <div className="files-grid-skeleton">
                            {[...Array(12)].map((_, fileIndex) => (
                              <div className="file-item-skeleton skeleton-animation" key={fileIndex}></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="search-prompt">Type to search...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for File Details */}
      <FileDetailsModal
        open={showFileModal}
        onClose={handleCloseModal}
        fileId={selectedFile?.fileId}
      />
    </>
  );
}

export default SearchOverlay;
