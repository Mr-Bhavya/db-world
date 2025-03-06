import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Form, Carousel } from "react-bootstrap";
import styles from "./MovieDetail.module.css"; // CSS module
import { getRecordDetailsbyId } from "../../../ApiServices";
import Constants from "../../../Constants";
import LoadingSpinner from "../../../LoadingSpinner";
import Reaction from "../../icons/reaction";
import Watchlist from "../../icons/watchlist";
import Watched from "../../icons/watched";
import Download from "../../icons/download";

const MovieDetailsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const id = location?.pathname?.split("/")?.pop()?.split("-")[0];
    const [record, setRecord] = useState(null);
    const [loader, setLoader] = useState(true);
    const [liked, setLiked] = useState(false);
    const [watchlisted, setWatchlisted] = useState(false);
    const [watched, setWatched] = useState(false);
    const [comment, setComment] = useState('');
    const [scrollY, setScrollY] = useState(0);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    const formatCurrency = (amount) => (amount ? `$${amount.toLocaleString()}` : 'N/A');

    const renderList = (items, key) =>
        items?.length > 0 ? (
            items.map((item) => (
                <Badge key={item[key]} bg="secondary" className="m-1">
                    {item.name}
                </Badge>
            ))
        ) : (
            <span className="text-muted">No information available</span>
        );

    // Helper: Render media carousel (e.g. for backdrops or posters)
    const renderMediaCarousel = (items, type) => (
        <Carousel interval={null} indicators={false} className={styles.mediaCarousel}>
            {items?.map((media, index) => (
                <Carousel.Item key={index}>
                    <div className={styles.mediaContainer}>
                        <img
                            className={`d-block ${styles.mediaImage}`}
                            src={`https://image.tmdb.org/t/p/w500${media.file_path}`}
                            alt={type}
                        />
                        <div className={styles.mediaMeta}>
                            {media.vote_average > 0 && (
                                <Badge bg="dark">
                                    {media.vote_average} ({media.vote_count} votes)
                                </Badge>
                            )}
                        </div>
                    </div>
                </Carousel.Item>
            ))}
        </Carousel>
    );

    // Helper: Render rating stars using Font Awesome
    const renderRatingStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 10; i++) {
            stars.push(
                <i
                    key={i}
                    className={`fas fa-star ${i <= rating ? styles.filled : ""}`}
                ></i>
            );
        }
        return <div className={styles.ratingStars}>{stars}</div>;
    };

    // Fetch record details by ID
    const getMovie = async () => {
        const response = await getRecordDetailsbyId(id);
        if (response.httpStatusCode === 200) {
            let rec = response.data;
            // Attach TMDB data based on record type
            rec["tmdb"] = rec.type === Constants.RECORD_TYPE_MOVIE ? rec.movieTmdb : rec.seriesTmdb;
            if (rec === "No results found") {
                navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
            } else {
                // Set user action states from record
                setLiked(rec.isLiked);
                setWatchlisted(rec.isWatchListed);
                setWatched(rec.isWatched);
                setRecord(rec);
            }
            setLoader(false);
        } else if (response.httpStatusCode === 401) {
            navigate(Constants.LOGIN_ROUTE, {state: {from: location}});
        } else {
            console.error(response.message);
            navigate(Constants.DB_WORLD_HOME_ROUTE);
        }
    };

    useEffect(() => {
        if (id) getMovie();
    }, [id]);

    // Update scroll position for parallax effect
    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Listen to window resize for mobile detection
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    if (loader) return <LoadingSpinner />;

    return (
        <Container fluid className={styles.movieContainer}>
            {/* Backdrop Section */}
            <div
                className={styles.backdropSection}
                style={{
                    // Disable parallax transform on mobile devices (width < 576px)
                    transform:
                        `translateY(${scrollY * 0.3}px)`,
                    opacity: Math.max(1 - scrollY / 500, 0.5),
                }}
            >
                {record.movieTmdb?.backdrop_path && (
                    <div
                        className={styles.backdropImage}
                        style={{
                            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(https://image.tmdb.org/t/p/w500${record.movieTmdb.backdrop_path})`,
                        }}
                    />
                )}
                <div className={styles.headerContent}>
                    <Row className="align-items-end">
                        <Col className={styles.posterColumn}>
                            <img
                                src={`https://image.tmdb.org/t/p/w500${record.movieTmdb.poster_path || record.movieTmdb.backdrop_path}`}
                                className={styles.poster}
                                alt={record.movieTmdb?.title}
                            />
                        </Col>
                        <Col>
                            <h1 className={styles.title}>{record.movieTmdb?.title}</h1>
                            {record.movieTmdb?.tagline && (
                                <small className="text-secondary d-block mt-2">
                                    "{record.movieTmdb.tagline}"
                                </small>
                            )}
                            <div className={styles.metaInfo}>
                                <Badge bg="dark" className="me-2">
                                    Released: {record.movieTmdb?.release_date}
                                </Badge>
                                <Badge bg="dark" className="me-2">
                                    {record.movieTmdb?.runtime} mins
                                </Badge>
                                <Badge bg="dark">
                                    Rating: {record.movieTmdb?.vote_average}/10
                                </Badge>
                            </div>
                            <div className="action-buttons">
                                <Reaction isLiked={record?.isLiked} recordId={record.recordId} userId={""} />
                                <Download record={record} userId={""} />
                                <Watchlist isAddedToWatchList={record?.isWatchListed} isWatched={record?.isWatched} recordId={record.recordId} />
                                <Watched isWatched={record?.isWatched} recordId={record.recordId} />
                            </div>
                        </Col>
                    </Row>
                </div>
            </div>

            {/* Main Content */}
            <Row className="mt-1">
                <Col md={8}>
                    <Card className={styles.detailCard}>
                        <Card.Body>
                            <h3 className={`${styles.sectionTitle} text-light`}>Overview</h3>
                            <p className={`${styles.overview} text-light`}>
                                {record.movieTmdb?.overview || "No overview available"}
                            </p>
                            <Row className="mt-4">
                                <Col md={6}>
                                    <h4 className={styles.sectionTitle}>Genres</h4>
                                    <div className={styles.genreList}>
                                        {renderList(record.movieTmdb?.genres, "id")}
                                    </div>
                                    <div className="mt-4">
                                        <h4 className={styles.sidebarTitle}>Providers</h4>
                                        {(!record.movieTmdb?.providers?.flatrate?.length &&
                                            !record.movieTmdb?.providers?.rent?.length &&
                                            !record.movieTmdb?.providers?.buy?.length) ? (
                                            <p className="text-light">Not available for streaming</p>
                                        ) : (
                                            <div>
                                                {record.movieTmdb?.providers?.flatrate?.length > 0 && (
                                                    <div className="d-flex align-items-center mx-1 my-3">
                                                        <span className="text-light me-2">Streaming on</span>
                                                        {record.movieTmdb.providers.flatrate.map((provider) => (
                                                            <img
                                                                key={provider.provider_id}
                                                                src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                                alt={provider.provider_name}
                                                                className={`${styles.providerLogo} me-2`}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {(record.movieTmdb?.providers?.buy?.length > 0 ||
                                                    record.movieTmdb?.providers?.rent?.length > 0) && (
                                                        <div className="d-flex align-items-center mx-1 my-2">
                                                            <span className="text-light me-2">
                                                                Buy and Rent from
                                                            </span>
                                                            {record.movieTmdb?.providers?.buy?.map((provider) => (
                                                                <img
                                                                    key={provider.provider_id}
                                                                    src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                                    alt={provider.provider_name}
                                                                    className={`${styles.providerLogo} me-2`}
                                                                />
                                                            ))}
                                                            {record.movieTmdb?.providers?.rent?.map((provider) => (
                                                                <img
                                                                    key={provider.provider_id}
                                                                    src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                                    alt={provider.provider_name}
                                                                    className={`${styles.providerLogo} me-2`}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                            <div className="mt-4 text-light">
                                <h3 className={styles.sectionTitle}>Cast</h3>
                                <div className={styles.castGrid}>
                                    {record.movieTmdb?.credits?.cast
                                        ?.filter((member) => member.profile_path)
                                        ?.slice(0, 10)
                                        .map((member) => (
                                            <div key={member.id} className={styles.castMember}>
                                                <img
                                                    src={
                                                        member.profile_path
                                                            ? `https://image.tmdb.org/t/p/w200${member.profile_path}`
                                                            : "/placeholder-avatar.jpg"
                                                    }
                                                    alt={member.name}
                                                    className={styles.castImage}
                                                />
                                                <div className={styles.castInfo}>
                                                    <strong>{member.name}</strong>
                                                    <small className="d-block">{member.character}</small>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            {record.movieTmdb?.credits?.crew?.length > 0 && (
                                <div className="mt-4 text-light">
                                    <h3 className={styles.sectionTitle}>Crew</h3>
                                    <div className={styles.castGrid}>
                                        {record.movieTmdb?.credits?.crew
                                            ?.filter((member) => member.profile_path)
                                            ?.slice(0, 10)
                                            .map((member) => (
                                                <div key={member.id} className={styles.castMember}>
                                                    <img
                                                        src={
                                                            member.profile_path
                                                                ? `https://image.tmdb.org/t/p/w200${member.profile_path}`
                                                                : "/placeholder-avatar.jpg"
                                                        }
                                                        alt={member.name}
                                                        className={styles.castImage}
                                                    />
                                                    <div className={styles.castInfo}>
                                                        <strong>{member.name}</strong>
                                                        <small className="d-block">{member.job}</small>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className={styles.sidebarCard}>
                        <Card.Body>
                            <h4 className={styles.sidebarTitle}>Production Details</h4>
                            <div className={`${styles.productionInfo} text-light`}>
                                <h5>Companies</h5>
                                {renderList(record.movieTmdb?.production_companies, "id")}
                                {
                                    record.movieTmdb?.production_countries.size > 0 && <><h5 className="mt-3">Countries</h5>
                                        {renderList(record.movieTmdb?.production_countries, "iso_3166_1")}</>
                                }
                                {
                                    record.movieTmdb?.production_countries.size > 0 && <><h5 className="mt-3">Languages</h5>
                                        {renderList(record.movieTmdb?.spoken_languages, "iso_639_1")}</>
                                }
                            </div>
                            {record.movieTmdb?.vote_average &&
                                record.movieTmdb?.vote_average > 0 && (
                                    <div className="mt-4">
                                        <h4 className={styles.sidebarTitle}>Rating</h4>
                                        {renderRatingStars(record.movieTmdb?.vote_average)}
                                    </div>
                                )}
                            <Card className={`mt-4 ${styles.detailCard}`}>
                                <Card.Body>
                                    <h3 className={styles.subTitle}>Comments</h3>
                                    <Form>
                                        <Form.Group className="mb-3">
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                placeholder="Add your comment..."
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                            />
                                        </Form.Group>
                                        <Button variant="primary" type="submit">
                                            <i className="fas fa-comment-alt"></i> Submit
                                        </Button>
                                    </Form>
                                </Card.Body>
                            </Card>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <Row>
                <h3 className={styles.sectionTitle}>Media</h3>
                <div className={styles.mediaTabs}>
                    <Col>
                        <div className={styles.mediaSection}>
                            <h4>Trailers</h4>
                            {record.movieTmdb?.videos?.length > 0 ? (
                                <div className={styles.videoGrid}>
                                    {record.movieTmdb.videos?.slice(0, 5)?.map((video) => (
                                        <div key={video.id} className={styles.videoItem}>
                                            <iframe
                                                src={`https://www.youtube.com/embed/${video.key}`}
                                                title={video.name}
                                                allowFullScreen
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-light">No trailers available</p>
                            )}
                        </div>
                    </Col>
                    <Col>
                        <div className={styles.mediaSection}>
                            <h4>Backdrops</h4>
                            {renderMediaCarousel(record.movieTmdb?.images?.backdrops, "backdrop")}
                        </div>
                    </Col>
                    <Col>
                        <div className={styles.mediaSection}>
                            <h4>Posters</h4>
                            {renderMediaCarousel(record.movieTmdb?.images?.posters, "poster")}
                        </div>
                    </Col>
                </div>
            </Row>
        </Container>
    );
};

export default MovieDetailsPage;
