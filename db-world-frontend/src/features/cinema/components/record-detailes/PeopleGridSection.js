// components/PeopleGridSection.jsx
import { Box, Typography, Avatar, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';
import { PeopleGrid, SubSectionTitle } from './CustomComponents';

const PeopleGridSection = ({ title, people = [], getSecondaryText }) => {
  const visiblePeople = people?.filter(p => p.profilePath ?? p.profile_path).slice(0, 10);

  if (!visiblePeople?.length) return null;

  return (
    <Grid item xs={12} md={6}>
      <SubSectionTitle variant="h6" gutterBottom>{title}</SubSectionTitle>
      <PeopleGrid>
        {visiblePeople.map(person => (
          <Box key={person.id}>
            <Avatar
              src={`https://image.tmdb.org/t/p/w200${person.profilePath ?? person.profile_path}`}
              alt={person.name}
              sx={{ width: 80, height: 80, mx: 'auto' }}
            />
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Typography variant="subtitle2" noWrap>{person.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {getSecondaryText(person)}
              </Typography>
            </Box>
          </Box>
        ))}
      </PeopleGrid>
    </Grid>
  );
};

export default PeopleGridSection;