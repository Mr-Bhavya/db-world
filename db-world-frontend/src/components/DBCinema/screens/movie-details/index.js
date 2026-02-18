import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Container,
    Typography,
    CardContent,
    Grid,
    useTheme,
} from "@mui/material";
import { getRecordDetailsbyId } from "../../../ApiServices";
import Constants from "../../../Constants";
import LoadingSpinner from "../../../LoadingSpinner";
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
        const response = await getRecordDetailsbyId(id);
        if (response.httpStatusCode === 200) {
            let rec = response.data;
            rec["tmdb"] = rec.type === Constants.RECORD_TYPE_MOVIE ? rec.movieTmdb : rec.seriesTmdb;
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
        if (id) getMovie();
    }, [id]);

    if (loader) return <LoadingSpinner />;

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
                                {record.movieTmdb?.overview || "No overview available"}
                            </Typography>

                            {/* Genres & Providers */}
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <SectionTitle variant="h6">Genres</SectionTitle>
                                    <GenresList genres={record.movieTmdb?.genres} />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <SectionTitle variant="h6">Providers</SectionTitle>
                                    <StreamingProviders providers={record.movieTmdb?.providers} />
                                </Grid>
                            </Grid>

                            <Grid container spacing={2} sx={{ mt: 4 }}>
                                <PeopleGridSection
                                    title="Cast"
                                    people={record.movieTmdb?.credits?.cast}
                                    getSecondaryText={(person) => person.character}
                                />

                                <PeopleGridSection
                                    title="Crew"
                                    people={record.movieTmdb?.credits?.crew}
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
                                productionCompanies={record.movieTmdb?.production_companies}
                                productionCountries={record.movieTmdb?.production_countries}
                                spokenLanguages={record.movieTmdb?.spoken_languages}
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