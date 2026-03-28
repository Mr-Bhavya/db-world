import React from 'react';
import { Box, Card, Typography, styled, Avatar } from '@mui/material';
import CardContent from '@mui/material/CardContent';
import { DetailCard, SectionTitle } from './CustomComponents';


const ProductionDetails = ({ productionCompanies, productionCountries, spokenLanguages }) => {
    const renderTextList = (items, keyField, labelField = 'name') => {
        if (!items || items.length === 0) {
            return <Typography variant="body2" color="textSecondary">None listed</Typography>;
        }

        return items.map((item, index) => (
            <Typography
                key={item[keyField] || `${labelField}-${index}`}
                variant="body2"
                sx={{ mr: 1, mb: 0.5 }}
            >
                {item[labelField] || item.iso_3166_1}
                {index < items.length - 1 ? ',' : ''}
            </Typography>
        ));
    };

    const renderCompanyList = (items) => {
        if (!items || items.length === 0) {
            return <Typography variant="body2" color="textSecondary">None listed</Typography>;
        }

        return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {items.map((company) => (
                    <Box key={company.id} sx={{ display: 'flex', alignItems: 'center' }}>
                        {company.logo_path && (
                            <Avatar
                                src={`https://image.tmdb.org/t/p/w200${company.logo_path}`}
                                alt={company.name}
                                sx={{ width: 32, height: 32, mr: 1 }}
                            />
                        )}
                        <Typography variant="body2">{company.name}</Typography>
                    </Box>
                ))}
            </Box>
        );
    };

    return (
        <DetailCard>
            <CardContent>
                <SectionTitle>Production Details</SectionTitle>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Companies</Typography>
                    {renderCompanyList(productionCompanies)}
                </Box>

                {productionCountries?.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">Countries</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                            {renderTextList(productionCountries, "iso_3166_1")}
                        </Box>
                    </Box>
                )}

                {spokenLanguages?.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">Spoken Languages</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                            {renderTextList(spokenLanguages, "iso_639_1")}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </DetailCard>
    );
};

export default ProductionDetails;