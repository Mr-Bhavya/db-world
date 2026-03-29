import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Container,
    Typography,
    CardContent,
    Grid,
    useTheme,
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

const MovieDetailsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const id = location?.pathname?.split("/")?.pop()?.split("-")[0];
    const [record, setRecord] = useState(null);
    const [loader, setLoader] = useState(true);
    const [comment, setComment] = useState('');
    const [rating, setRating] = useState(0);
    const [userRating, setUserRating] = useState(null);

    const handleCommentSubmit = (e) => {
        e.preventDefault();
        // Here you would typically send the comment and rating to your backend
        //console.log('Submitted:', { comment, rating });
        setUserRating({ comment, rating, date: new Date().toLocaleDateString() });
        setComment('');
        setRating(0);
    };

    const getMovie = async () => {
        try {
            const rec = await fetchRecord(id);
            if (!rec) { navigate(Constants.DB_CINEMA_BROWSE_ROUTE); return; }
            // Normalise: detail pages expect record.tmdb to hold TMDB data
            if (!rec.tmdb) rec.tmdb = rec.movieTmdb ?? rec.seriesTmdb ?? {};
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
        if (id) getMovie();
    }, [id]);

    if (loader) return <LoadingSpinner />;

    // Normalize credits: flat List<CreditDto> → separate cast/crew arrays
    const credits = record?.tmdb?.credits ?? [];
    const cast = credits
        .filter(c => c.creditType === 'CAST')
        .map(c => ({ ...c.person, profilePath: c.person?.profilePath, character: c.character }));
    const crew = credits
        .filter(c => c.creditType === 'CREW')
        .map(c => ({ ...c.person, profilePath: c.person?.profilePath, job: c.job }));

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

                            <Grid container spacing={2} sx={{ mt: 4 }}>
                                <PeopleGridSection
                                    title="Cast"
                                    people={cast}
                                    getSecondaryText={(person) => person.character}
                                />

                                <PeopleGridSection
                                    title="Crew"
                                    people={crew}
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
                        <Grid item xs={12} md={6}>
                            <ProductionDetails
                                productionCompanies={record.tmdb?.productionCompanies ?? record.tmdb?.production_companies}
                                productionCountries={record.tmdb?.productionCountries ?? record.tmdb?.production_countries}
                                spokenLanguages={record.tmdb?.spokenLanguages ?? record.tmdb?.spoken_languages}
                            />
                        </Grid>

                        {/* RatingReviewSection */}
                        <Grid item xs={12} md={6}>
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

export default MovieDetailsPage;