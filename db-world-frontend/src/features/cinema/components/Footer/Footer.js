import React from 'react';
import { Box, Typography, Link, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { Facebook, Twitter, Instagram, YouTube } from '@mui/icons-material';

const Footer = ({ 
  onNavigate = () => {},
  onCategorySelect = () => {},
  companyName = "DB Cinema",
  showSocialLinks = true 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleNavigation = (item, type = 'page') => {
    if (type === 'category') {
      onCategorySelect(item);
    } else {
      onNavigate(item);
    }
  };

  // Minimal navigation links - combined categories
  const quickLinks = [
    { label: 'Home', onClick: () => handleNavigation('Home') },
    { label: 'Movies', onClick: () => handleNavigation('Movies') },
    { label: 'TV Shows', onClick: () => handleNavigation('TV Shows') },
    { label: 'My List', onClick: () => handleNavigation('My List') },
  ];

  const infoLinks = [
    { label: 'Privacy', onClick: () => handleNavigation('Privacy Policy') },
    { label: 'Terms', onClick: () => handleNavigation('Terms of Service') },
    { label: 'Help', onClick: () => handleNavigation('Help Center') },
    { label: 'Contact', onClick: () => handleNavigation('Contact Us') },
  ];

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isSmallMobile ? 2 : 3,
        marginTop: 'auto',
      }}
    >
      {/* Main Footer Content */}
      <Box
        sx={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? 3 : 2,
        }}
      >
        {/* Brand & Social */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1,
          order: isMobile ? 2 : 1 
        }}>
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.primary.main,
              fontWeight: 700,
              fontSize: isSmallMobile ? '1rem' : '1.1rem',
            }}
          >
            {companyName}
          </Typography>
          
          {showSocialLinks && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton 
                size="small" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: 0.5,
                  '&:hover': { color: theme.palette.primary.main }
                }}
              >
                <Facebook fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: 0.5,
                  '&:hover': { color: theme.palette.primary.main }
                }}
              >
                <Twitter fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: 0.5,
                  '&:hover': { color: theme.palette.primary.main }
                }}
              >
                <Instagram fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: 0.5,
                  '&:hover': { color: theme.palette.primary.main }
                }}
              >
                <YouTube fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Navigation Links */}
        <Box sx={{ 
          display: 'flex', 
          gap: isMobile ? 3 : 4,
          order: isMobile ? 1 : 2,
          flexWrap: 'wrap'
        }}>
          {/* Quick Links */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                component="button"
                onClick={link.onClick}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: isSmallMobile ? '0.8rem' : '0.85rem',
                  textDecoration: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: theme.palette.primary.main,
                  },
                }}
              >
                {link.label}
              </Link>
            ))}
          </Box>

          {/* Info Links */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {infoLinks.map((link) => (
              <Link
                key={link.label}
                component="button"
                onClick={link.onClick}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: isSmallMobile ? '0.8rem' : '0.85rem',
                  textDecoration: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: theme.palette.primary.main,
                  },
                }}
              >
                {link.label}
              </Link>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Copyright - Minimal */}
      <Box
        sx={{
          maxWidth: 1200,
          margin: '0 auto',
          marginTop: isMobile ? 2 : 3,
          paddingTop: isMobile ? 2 : 3,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: isSmallMobile ? '0.7rem' : '0.75rem',
          }}
        >
          © {new Date().getFullYear()} {companyName}. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;