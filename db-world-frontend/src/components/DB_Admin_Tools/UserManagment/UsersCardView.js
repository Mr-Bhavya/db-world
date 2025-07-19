import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Collapse,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    IconButton,
    InputAdornment,
    Paper,
    Radio,
    RadioGroup,
    TextField,
    Typography,
    Tooltip
} from '@mui/material';
import {
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
    Visibility,
    VisibilityOff
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '../../Constants';
import UserEditModal from './UserEditModal';

const UsersCardView = ({ users, onUpdate, onDelete }) => {
    const dispatch = useDispatch();
    const [userData, setUserData] = useState(users);
    const [expandedUser, setExpandedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);


    // Format date for display
    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
        } catch {
            return dateString;
        }
    }, []);

    const handleSave = async (updatedUser) => {
        try {
            await onUpdate(updatedUser);
            setEditModalOpen(false);
        } catch (error) {
            console.error("Update error:", error);
        }
    };

    const toggleExpandUser = (userId) => {
        setExpandedUser(expandedUser === userId ? null : userId);
    };

    useEffect(() => {
        setLoading(!users || users.length === 0);
    }, [users]);

    const UserCard = React.memo(({ user, index }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
        >
            <Card sx={{ mb: 2 }}>
                <CardHeader
                    title={
                        <Box display="flex" alignItems="center">
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {user.firstName} {user.lastName}
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton onClick={() => toggleExpandUser(user.userId)}>
                                {expandedUser === user.userId ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                        </Box>
                    }
                    subheader={
                        <Box>
                            <Typography variant="caption">ID: {user.userId}</Typography>
                            <Typography variant="caption" display="block">Email: {user.email}</Typography>
                            <Typography variant="caption" display="block">Contact: {user.mobileNo}</Typography>
                        </Box>
                    }
                />

                <Collapse in={expandedUser === user.userId}>
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><strong>First Name:</strong> {user.firstName}</Typography>
                                <Typography variant="body2"><strong>Last Name:</strong> {user.lastName}</Typography>
                                <Typography variant="body2"><strong>Email:</strong> {user.email}</Typography>
                                <Typography variant="body2"><strong>Contact:</strong> {user.mobileNo}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><strong>Gender:</strong> {user.gender}</Typography>
                                <Typography variant="body2">
                                    <strong>DOB:</strong> {formatDate(user.dob)}
                                </Typography>
                                <Typography variant="body2"><strong>Logins:</strong> {user?.noOfLogin}</Typography>
                                <Typography variant="body2"><strong>Role:</strong> {user.userRole?.name}</Typography>
                            </Grid>
                        </Grid>

                        {user.loginData?.length > 0 && (
                            <Box mt={2}>
                                <Typography variant="subtitle2">Recent Logins:</Typography>
                                <Paper variant="outlined" sx={{ p: 1 }}>
                                    {user.loginData.map((data, idx) => (
                                        typeof data.lastLoginDate !== 'object' && (
                                            <Typography key={idx} variant="caption" display="block">
                                                {formatDate(data.lastLoginDate)}
                                            </Typography>
                                        )
                                    ))}
                                </Paper>
                            </Box>
                        )}
                    </CardContent>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => {
                                setSelectedUser(user);
                                setEditModalOpen(true);
                            }}
                            sx={{ mr: 1 }}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                                onDelete(user);
                            }}
                        >
                            Delete
                        </Button>
                    </Box>
                </Collapse>
            </Card>
        </motion.div>
    ));

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {userData.map((user, index) => (
                        <Grid item xs={12} key={user.userId}>
                            <UserCard user={user} index={index} />
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Edit User Modal */}
            <UserEditModal
                user={selectedUser}
                open={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setSelectedUser(null);
                }}
                onSave={handleSave}
            />

            {Constants.TOAST_CONTAINER}
        </Container>
    );
};

export default React.memo(UsersCardView);