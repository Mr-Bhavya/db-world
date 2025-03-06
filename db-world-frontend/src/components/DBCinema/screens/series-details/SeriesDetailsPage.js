import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Form, Tabs, Tab } from "react-bootstrap";
import styles from "./SeriesDetailsPage.module.css";
import { getRecordDetailsbyId } from "../../../ApiServices";
import Constants from "../../../Constants";
import LoadingSpinner from "../../../LoadingSpinner";
import Reaction from "../../icons/reaction";
import Download from "../../icons/download";
import Watchlist from "../../icons/watchlist";
import Watched from "../../icons/watched";

const SeriesDetailsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const id = location?.pathname?.split("/")?.pop()?.split("-")[0];
    const [record, setRecord] = useState(null);
    const [loader, setLoader] = useState(true);
    const [comment, setComment] = useState('');
    const [scrollY, setScrollY] = useState(0);

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

    // Fetch series details
    const getSeries = async () => {
        const response = await getRecordDetailsbyId(id);
        if (response.httpStatusCode === 200) {
            let rec = response.data;
            rec["tmdb"] = rec.seriesTmdb;
            if (rec === "No results found") {
                navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
            } else {
                setRecord(rec);
            }
            setLoader(false);
        } else if (response.httpStatusCode === 401) {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
            console.error(response.message);
            navigate(Constants.DB_WORLD_HOME_ROUTE);
        }
    };

    useEffect(() => {
        if (id) getSeries();
    }, [id]);

    // Scroll handler for backdrop effect
    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (loader) return <LoadingSpinner />;

    const { tmdb } = record;
    const backdropUrl = tmdb.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}` : '';
    const posterUrl = tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : '';

    return (
        <Container fluid className={styles.seriesContainer}>
            {/* Backdrop Section */}
            <div
                className={styles.backdropSection}
                style={{
                    transform: `translateY(${scrollY * 0.3}px)`,
                    opacity: Math.max(1 - scrollY / 500, 0.5),
                }}
            >
                {backdropUrl && (
                    <div
                        className={styles.backdropImage}
                        style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${backdropUrl})` }}
                    />
                )}
                <div className={styles.headerContent}>
                    <Row className="align-items-end">
                        <Col className={styles.posterColumn}>
                            <img src={posterUrl} className={styles.poster} alt={tmdb?.name} />
                        </Col>
                        <Col className="my-5">
                            <h1 className={styles.title}>{tmdb?.title}</h1>
                            {tmdb?.tagline && (
                                <small className="text-secondary d-block mt-2">
                                    "{tmdb.tagline}"
                                </small>
                            )}
                            <div className={styles.genreList}>
                                {tmdb?.genres?.map(genre => (
                                    <Badge key={genre.id} bg="light" text="dark" className="me-2">
                                        {genre.name}
                                    </Badge>
                                ))}
                            </div>
                            <div className={styles.metaInfo}>
                                <Badge bg="dark" className="me-2">
                                    First Air: {tmdb?.first_air_date}
                                </Badge>
                                <Badge bg="dark" className="me-2">
                                    {tmdb?.number_of_seasons} Seasons
                                </Badge>
                                <Badge bg="dark">
                                    Rating: {tmdb?.vote_average}/10
                                </Badge>
                            </div>
                            <div className={styles.actionButtons}>
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
                            <h3 className={styles.sectionTitle}>Overview</h3>
                            <p className={styles.overview}>
                                {tmdb?.overview || "No overview available"}
                            </p>

                            {/* Seasons Tabs */}
                            {tmdb?.seasons?.length > 1 && (
                                <Tabs defaultActiveKey={tmdb.seasons[0].id} className="mb-4">
                                    {tmdb.seasons.map(season => (
                                        <Tab
                                            key={season.id}
                                            eventKey={season.id}
                                            title={season.name}
                                        >
                                            <div className="mt-3">
                                                <Row className="g-3">
                                                    <Col>
                                                        {season.poster_path && (
                                                            <img
                                                                src={`https://image.tmdb.org/t/p/w300${season.poster_path}`}
                                                                alt={season.name}
                                                                className={styles.seasonPoster}
                                                            />
                                                        )}
                                                    </Col>
                                                    <Col>
                                                        <h3 className=" text-light">{season.name}</h3>
                                                        <p className=" text-light">{season.overview}</p>
                                                        <div className={styles.seasonMeta}>
                                                            <Badge bg="dark">
                                                                {season.episode_count} episodes
                                                            </Badge>
                                                            <Badge bg="dark">
                                                                Aired: {season.air_date}
                                                            </Badge>
                                                        </div>
                                                    </Col>
                                                </Row>
                                            </div>
                                        </Tab>
                                    ))}
                                </Tabs>
                            )}

                            {/* Single Season Display */}
                            {tmdb?.seasons?.length === 1 && (
                                <div className="mt-4">
                                    <h3 className={styles.sectionTitle + " text-light"}>{tmdb.seasons[0].name}</h3>
                                    <Row className="g-3">
                                        <Col>
                                            {tmdb.seasons[0].poster_path && (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w300${tmdb.seasons[0].poster_path}`}
                                                    alt={tmdb.seasons[0].name}
                                                    className={styles.seasonPoster}
                                                />
                                            )}
                                        </Col>
                                        <Col>
                                            <p className="text-light">{tmdb.seasons[0].overview}</p>
                                            <div className={styles.seasonMeta}>
                                                <Badge bg="dark">
                                                    {tmdb.seasons[0].episode_count} episodes
                                                </Badge>
                                                <Badge bg="fark">
                                                    Aired: {tmdb.seasons[0].air_date}
                                                </Badge>
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            )}

                            {/* Cast Section */}
                            <div className="mt-4">
                                <h3 className={styles.sectionTitle}>Cast</h3>
                                <div className={styles.castGrid}>
                                    {tmdb?.credits?.cast
                                        ?.filter(member => member.profile_path)
                                        ?.slice(0, 10)
                                        .map(member => (
                                            <div key={member.id} className={styles.castMember}>
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w200${member.profile_path}`}
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
                        </Card.Body>
                    </Card>
                </Col>

                {/* Sidebar */}
                <Col md={4}>
                    <Card className={styles.sidebarCard}>
                        <Card.Body>
                            {/* Networks */}
                            <div className="mb-4">
                                <h4 className={styles.sidebarTitle}>Networks</h4>
                                <div className={styles.networkGrid}>
                                    {tmdb?.networks?.map(network => (
                                        <div key={network.id} className={styles.networkItem}>
                                            {network.logo_path && (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w92${network.logo_path}`}
                                                    alt={network.name}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Providers */}
                            <div className="mb-4">
                                <h4 className={styles.sidebarTitle}>Streaming Providers</h4>
                                <div className={styles.providerGrid}>
                                    {tmdb?.providers?.flatrate?.map(provider => (
                                        <div key={provider.provider_id} className={styles.providerItem}>
                                            <img
                                                src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                                alt={provider.provider_name}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Comments */}
                            <div className="mt-4">
                                <h4 className={styles.sidebarTitle}>Comments</h4>
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
                                        Submit Comment
                                    </Button>
                                </Form>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default SeriesDetailsPage;