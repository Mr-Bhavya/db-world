import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Container,
    Typography,
    CardContent,
    Grid,
    useTheme,
    Tabs,
    Tab,
    Box,
    Chip,
} from "@mui/material";
import { fetchRecord } from '../../api/cinemaApi';
import Constants from '@shared/constants';
import LoadingSpinner from '@shared/components/ui/LoadingSpinner';
import PeopleGridSection from "../../components/record-detailes/PeopleGridSection";
import GenresList from "../../components/record-detailes/GenresList";
import StreamingProviders from "../../components/record-detailes/StreamingProviders";
import MediaSection from "../../components/record-detailes/MediaSection";
import ProductionDetails from "../../components/record-detailes/ProductionDetails";
import RatingReviewSection from "../../components/record-detailes/RatingReviewSection";
import BackdropSection from "../../components/record-detailes/BackdropSection";
import { DetailCard, SectionTitle } from "../../components/record-detailes/CustomComponents";
import SeasonTabs from "./SeasonTabs";

const SeriesDetailsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const id = location?.pathname?.split("/")?.pop()?.split("-")[0];
    const [record, setRecord] = useState(null);
    const [loader, setLoader] = useState(true);
    const [comment, setComment] = useState('');
    const [rating, setRating] = useState(0);
    const [userRating, setUserRating] = useState(null);
    const [activeSeasonTab, setActiveSeasonTab] = useState(0);
    const theme = useTheme();

    const handleCommentSubmit = (e) => {
        e.preventDefault();
        //console.log('Submitted:', { comment, rating });
        setUserRating({ comment, rating, date: new Date().toLocaleDateString() });
        setComment('');
        setRating(0);
    };

    const getSeries = async () => {
        try {
            const rec = await fetchRecord(id);
            if (!rec) { navigate(Constants.DB_CINEMA_BROWSE_ROUTE); return; }
            if (!rec.tmdb) rec.tmdb = rec.seriesTmdb ?? rec.movieTmdb ?? {};
            setRecord(rec);
        } catch (err) {
            if (err?.response?.status === 401)
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            else
                navigate(Constants.DB_WORLD_HOME_ROUTE);
        } finally {
            setLoader(false);
        }
    };

    useEffect(() => {
        if (id) getSeries();
    }, [id]);

    if (loader) return <LoadingSpinner />;

    const handleSeasonTabChange = (event, newValue) => {
        setActiveSeasonTab(newValue);
    };

    return (
        <Container maxWidth="xl" sx={{
            backgroundColor: '#181818',
            color: '#fff',
            p: 0,
            overflow: 'hidden',
        }}>
            {/* Backdrop Section */}
            <BackdropSection record={record} />

            {/* Main Content */}
            <Grid container spacing={3} sx={{ p: 0, mt: 2 }}>
                <Grid item xs={12} md={8}>
                    <DetailCard>
                        <CardContent>
                            {/* Overview */}
                            <SectionTitle>Overview</SectionTitle>
                            <Typography variant="body1" paragraph>
                                {record.tmdb?.overview || "No overview available"}
                            </Typography>

                            {/* Genres & Providers */}
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <SectionTitle variant="h6">Genres</SectionTitle>
                                    <GenresList genres={record.tmdb?.genres} />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <SectionTitle variant="h6">Providers</SectionTitle>
                                    <StreamingProviders providers={record.tmdb?.providers} />
                                </Grid>
                            </Grid>

                            <SeasonTabs
                                seasons={record.tmdb?.seasons}
                                loading={!record.tmdb?.seasons}
                            />

                            {/* People Sections */}
                            <Grid container spacing={2} sx={{ mt: 4 }}>
                                <PeopleGridSection
                                    title="Cast"
                                    people={record.tmdb?.credits?.cast}
                                    getSecondaryText={(person) => person.character}
                                />

                                <PeopleGridSection
                                    title="Crew"
                                    people={record.tmdb?.credits?.crew}
                                    getSecondaryText={(person) => person.job}
                                />
                            </Grid>
                        </CardContent>
                    </DetailCard>

                    {/* Media Section */}
                    <MediaSection record={record} />
                </Grid>

                <Grid item xs={12} md={4}>
                    <Grid container spacing={2}>
                        {/* ProductionDetails */}
                        <Grid item xs={12}>
                            <ProductionDetails
                                productionCompanies={record.tmdb?.production_companies}
                                productionCountries={record.tmdb?.production_countries}
                                spokenLanguages={record.tmdb?.spoken_languages}
                                networks={record.tmdb?.networks}
                            />
                        </Grid>

                        {/* RatingReviewSection */}
                        <Grid item xs={12}>
                            <RatingReviewSection
                                userRating={userRating}
                                onSubmit={handleCommentSubmit}
                            />
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </Container>
    );
};

export default SeriesDetailsPage;