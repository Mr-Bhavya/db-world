import { Box, Card, Typography, styled } from "@mui/material";
import { motion } from "framer-motion";

export const Backdrop = styled(motion.div)(({ theme }) => ({
    position: 'relative',
    width: '100%',
    height: '60vh',
    minHeight: 400,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    [theme.breakpoints.down('md')]: {
        height: '50vh',
    },
    [theme.breakpoints.down('sm')]: {
        height: '40vh',
        minHeight: 300,
    },
}));

export const BackdropImage = styled('div')(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'brightness(0.7)',
    zIndex: 1,
}));

export const HeaderContent = styled(Box)(({ theme }) => ({
    position: 'relative',
    zIndex: 2,
    padding: theme.spacing(4),
    width: '100%',
    //   maxWidth: 1200,
    margin: '0 auto',
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
    [theme.breakpoints.down('md')]: {
        padding: theme.spacing(2),
    },
}));

export const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.5rem',
    borderBottom: '2px solid #fff',
    paddingBottom: theme.spacing(1),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
        fontSize: '1.25rem',
    },
}));

export const SubSectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.125rem',
    fontWeight: 500,
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingBottom: theme.spacing(0.5),
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    [theme.breakpoints.down('sm')]: {
        fontSize: '1rem',
    },
}));


export const PeopleGrid = styled(Box)(({ theme }) => ({
    display: 'flex',
    overflowX: 'auto',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    '&::-webkit-scrollbar': {
        height: '5px',
    },
    '&::-webkit-scrollbar-track': {
        background: '#000',
    },
    '&::-webkit-scrollbar-thumb': {
        background: '#eee',
        borderRadius: '10px',
        '&:hover': {
            background: '#fff',
        },
    },
}));

export const DetailCard = styled(Card)(({ theme }) => ({
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    marginBottom: theme.spacing(2),
    color: '#fff',
    width: '100%',
}));

export const ScrollContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    overflowX: 'auto',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(1),
    '&::-webkit-scrollbar': {
        height: '5px',
    },
    '&::-webkit-scrollbar-track': {
        background: '#000',
    },
    '&::-webkit-scrollbar-thumb': {
        background: '#999',
        borderRadius: '10px',
        '&:hover': {
            background: '#fff',
        },
    },
}));