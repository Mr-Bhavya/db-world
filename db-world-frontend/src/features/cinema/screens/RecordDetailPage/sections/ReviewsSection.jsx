import React, { useState } from 'react';
import {
  Avatar, Box, Button, CircularProgress, Divider, IconButton,
  Paper, Rating, TextField, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme/ThemeContext';
import {
  fetchUserReviews, fetchMyReview, upsertReview, deleteReview,
} from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import { formatDate } from '../helpers';

function UserReviewCard({ review, T }) {
  const initials = (review.username ?? '?').slice(0, 2).toUpperCase();
  return (
    <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.07)}`, borderRadius: 2, p: 2, mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(T.teal, 0.3), fontSize: '0.8rem', fontWeight: 700, color: T.teal }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600 }}>{review.username}</Typography>
          {review.createdAt && <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(review.createdAt)}</Typography>}
        </Box>
        {review.rating != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating value={review.rating / 2} precision={0.5} readOnly size="small" sx={{ color: '#ff9800' }} />
            <Typography variant="caption" sx={{ color: T.textMuted }}>{review.rating}/10</Typography>
          </Box>
        )}
      </Box>
      {review.content && (
        <Typography variant="body2" sx={{ color: T.textMuted, lineHeight: 1.7 }}>{review.content}</Typography>
      )}
    </Paper>
  );
}

function TmdbReviewCard({ review, T }) {
  const [expanded, setExpanded] = useState(false);
  const content = review.content ?? '';
  const isLong = content.length > 400;

  return (
    <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.07)}`, borderRadius: 2, p: 2, mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(T.text, 0.08), fontSize: '0.8rem', color: T.textMuted }}>
          {(review.author ?? '?').slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600 }}>{review.author}</Typography>
          {review.authorDetails?.username && review.authorDetails.username !== review.author && (
            <Typography variant="caption" sx={{ color: T.textFaint }}>@{review.authorDetails.username}</Typography>
          )}
        </Box>
        {review.authorDetails?.rating != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating value={review.authorDetails.rating / 2} precision={0.5} readOnly size="small" sx={{ color: '#ff9800' }} />
            <Typography variant="caption" sx={{ color: T.textMuted }}>{review.authorDetails.rating}/10</Typography>
          </Box>
        )}
      </Box>
      <Typography
        variant="body2"
        sx={{ color: T.textMuted, lineHeight: 1.7, ...(!expanded && isLong ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}
      >
        {content}
      </Typography>
      {isLong && (
        <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ color: T.teal, mt: 0.5, p: 0, minWidth: 0, textTransform: 'none', fontSize: '0.78rem' }}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Paper>
  );
}

export default function ReviewsSection({ record, recordId }) {
  const T = useT();
  const qc = useQueryClient();

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState('');
  const [editMode, setEditMode] = useState(false);

  const { data: userReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['userReviews', recordId],
    queryFn: () => fetchUserReviews(recordId),
    staleTime: 2 * 60 * 1000,
  });

  const { data: myReview } = useQuery({
    queryKey: ['myReview', recordId],
    queryFn: () => fetchMyReview(recordId),
    staleTime: 2 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: ({ rating, content }) => upsertReview(recordId, rating, content),
    onSuccess: () => {
      notify.success('Review submitted.');
      qc.invalidateQueries(['userReviews', recordId]);
      qc.invalidateQueries(['myReview', recordId]);
      setReviewContent(''); setReviewRating(0); setEditMode(false);
    },
    onError: () => notify.error('Failed to submit review.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReview(recordId),
    onSuccess: () => {
      notify.success('Review deleted.');
      qc.invalidateQueries(['userReviews', recordId]);
      qc.invalidateQueries(['myReview', recordId]);
    },
    onError: () => notify.error('Failed to delete review.'),
  });

  const handleSubmit = () => {
    if (!reviewRating) { notify.warning('Please select a rating.'); return; }
    upsertMutation.mutate({ rating: reviewRating, content: reviewContent });
  };

  const handleEdit = () => {
    setReviewRating(myReview?.rating ?? 0);
    setReviewContent(myReview?.content ?? '');
    setEditMode(true);
  };

  const tmdbReviews = record?.tmdb?.reviews ?? [];
  const otherReviews = userReviews.filter((r) => r.id !== myReview?.id);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg ?? alpha(T.text, 0.04),
      color: T.text,
      '& fieldset': { borderColor: alpha(T.text, 0.15) },
      '&:hover fieldset': { borderColor: alpha(T.text, 0.3) },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputBase-input::placeholder': { color: T.textFaint },
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      <SectionHeading>Your Review</SectionHeading>

      {myReview && !editMode ? (
        <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.teal, 0.3)}`, borderRadius: 2, p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Rating value={myReview.rating / 2} precision={0.5} readOnly size="small" sx={{ color: '#ff9800' }} />
              <Typography variant="body2" sx={{ color: T.textMuted }}>{myReview.rating}/10</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={handleEdit} sx={{ color: T.teal }}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} sx={{ color: '#f44336' }}>
                  {deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          {myReview.content && <Typography variant="body2" sx={{ color: T.textMuted, lineHeight: 1.7 }}>{myReview.content}</Typography>}
        </Paper>
      ) : (
        <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.1)}`, borderRadius: 2, p: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ color: T.textMuted, mb: 1.5 }}>{editMode ? 'Update your review' : 'Write a review'}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ color: T.textFaint, minWidth: 60 }}>Rating</Typography>
            <Rating value={reviewRating / 2} precision={0.5} onChange={(_, val) => setReviewRating(Math.round((val ?? 0) * 2))} sx={{ color: '#ff9800' }} />
            <Typography variant="body2" sx={{ color: T.textMuted }}>{reviewRating > 0 ? `${reviewRating}/10` : ''}</Typography>
          </Box>
          <TextField
            fullWidth multiline rows={3}
            placeholder="Share your thoughts (optional)"
            value={reviewContent}
            onChange={(e) => setReviewContent(e.target.value)}
            sx={{ mb: 2, ...fieldSx }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={upsertMutation.isPending}
              startIcon={upsertMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover ?? '#0f766e' }, textTransform: 'none', fontWeight: 600 }}
            >
              {editMode ? 'Update' : 'Submit'}
            </Button>
            {editMode && (
              <Button variant="text" onClick={() => { setEditMode(false); setReviewContent(''); setReviewRating(0); }} sx={{ color: T.textFaint, textTransform: 'none' }}>
                Cancel
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {reviewsLoading ? (
        <CircularProgress size={24} sx={{ color: T.teal, display: 'block', mb: 3 }} />
      ) : otherReviews.length > 0 ? (
        <>
          <SectionHeading>All Reviews ({otherReviews.length})</SectionHeading>
          {otherReviews.map((r) => <UserReviewCard key={r.id} review={r} T={T} />)}
        </>
      ) : null}

      {tmdbReviews.length > 0 && (
        <>
          <Divider sx={{ borderColor: alpha(T.text, 0.08), my: 3 }} />
          <SectionHeading>TMDB Reviews ({tmdbReviews.length})</SectionHeading>
          {tmdbReviews.map((r, i) => <TmdbReviewCard key={i} review={r} T={T} />)}
        </>
      )}
    </Box>
  );
}
