import React, { useState } from 'react';
import {
    Box,
    Typography,
    Rating,
    TextField,
    Button,
    Divider
} from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CardContent from '@mui/material/CardContent';
import { DetailCard, SectionTitle } from './CustomComponents';

const RatingReviewSection = ({ userRating, onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ rating, comment });
        setRating(0);
        setComment('');
    };

    return (
        <DetailCard>
            <CardContent>
                <SectionTitle>Rate & Review</SectionTitle>

                <Box component="form" onSubmit={handleSubmit}>
                    <Typography component="legend">Your Rating</Typography>
                    <Rating
                        name="movie-rating"
                        value={rating}
                        onChange={(event, newValue) => {
                            setRating(newValue);
                        }}
                        precision={0.5}
                        emptyIcon={<StarBorderIcon fontSize="inherit" />}
                    />

                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Share your thoughts about this movie..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        variant="outlined"
                        sx={{ mt: 2 }}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        sx={{ mt: 2 }}
                        disabled={!rating}
                    >
                        Submit Review
                    </Button>
                </Box>

                {/* Display user's review if exists */}
                {userRating && (
                    <Box sx={{ mt: 3 }} >
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6">Your Review</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Rating
                                value={userRating.rating}
                                readOnly
                                precision={0.5}
                            />
                            <Typography variant="caption" sx={{ ml: 1 }}>
                                {userRating.date}
                            </Typography>
                        </Box>
                        <Typography>{userRating.comment}</Typography>
                    </Box>
                )}
            </CardContent>
        </DetailCard>
    );
};

export default RatingReviewSection;