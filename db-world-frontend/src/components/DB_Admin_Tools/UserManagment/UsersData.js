import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
  Typography 
} from '@mui/material';
import { 
  Search as SearchIcon, 
  ExpandMore as ExpandMoreIcon, 
  ExpandLess as ExpandLessIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { deleteUser, updateUserDetails } from '../../ApiServices';
import { findAllUsers } from '../../../redux/action/allActions';
import Constants from '../../Constants';

const UsersData = () => {
    const dispatch = useDispatch();
    const users = useSelector(state => state.userReducer.users);
    const [userData, setUserData] = useState(users);
    const [expandedUser, setExpandedUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [editUserData, setEditUserData] = useState({});
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSearch = (query) => {
        if (!query) {
            setUserData(users);
            return;
        }
        
        const filteredUsers = users?.filter(({ userId, email, firstName, lastName, mobileNo }) =>
            userId?.toString().toLowerCase().includes(query.toLowerCase()) ||
            email?.toLowerCase().includes(query.toLowerCase()) ||
            firstName?.toLowerCase().includes(query.toLowerCase()) ||
            lastName?.toLowerCase().includes(query.toLowerCase()) ||
            mobileNo?.toString().toLowerCase().includes(query.toLowerCase())
        );
        setUserData(filteredUsers);
    };

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setEditUserData(prev => ({ ...prev, [id]: value }));
    };

    const handleUpdateUser = async () => {
        setIsUpdating(true);
        const updatedUser = { ...selectedUser, ...editUserData };
        const { userId, email, firstName, lastName, mobileNo, dob, gender, password } = updatedUser;
        
        try {
            const updateUserRes = await updateUserDetails({ 
                userId, email, firstName, lastName, mobileNo, dob, gender, password 
            });
            
            if (updateUserRes.httpStatusCode === 200) {
                Constants.showToast.success("User updated successfully");
                dispatch(findAllUsers(users.map(user => 
                    user.userId === updatedUser.userId ? updatedUser : user
                )));
                setOpenEditDialog(false);
            } else {
                Constants.showToast.error(updateUserRes.message || "Failed to update user");
            }
        } catch (error) {
            Constants.showToast.error("An error occurred while updating user");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteUser = async () => {
        setIsDeleting(true);
        try {
            const deleteUserRes = await deleteUser(selectedUser.userId);
            if (deleteUserRes.httpStatusCode === 200) {
                Constants.showToast.success("User deleted successfully");
                dispatch(findAllUsers(userData.filter(user => user.userId !== selectedUser.userId)));
                setOpenDeleteDialog(false);
            } else {
                Constants.showToast.error(deleteUserRes?.message || "Failed to delete user");
            }
        } catch (error) {
            Constants.showToast.error("An error occurred while deleting user");
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        handleSearch(searchQuery);
    }, [searchQuery, users]);

    useEffect(() => {
        setLoading(!users || users.length === 0);
    }, [users]);

    const toggleExpandUser = (userId) => {
        setExpandedUser(expandedUser === userId ? null : userId);
    };

    const UserCard = ({ user, index }) => (
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
                                    <strong>{user.dob ? 'DOB:' : 'Age:'}</strong> {user.dob || user.age}
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
                                                {data.lastLoginDate}
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
                                setEditUserData(user);
                                setOpenEditDialog(true);
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
                                setSelectedUser(user);
                                setOpenDeleteDialog(true);
                            }}
                        >
                            Delete
                        </Button>
                    </Box>
                </Collapse>
            </Card>
        </motion.div>
    );

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ mb: 4 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>
            
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
            
            {/* Edit User Dialog */}
            <Dialog open={openEditDialog} onClose={() => !isUpdating && setOpenEditDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit {selectedUser?.firstName}'s Information</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Email"
                                id="email"
                                value={editUserData.email || ''}
                                disabled
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="First Name"
                                id="firstName"
                                value={editUserData.firstName || ''}
                                onChange={handleInputChange}
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Last Name"
                                id="lastName"
                                value={editUserData.lastName || ''}
                                onChange={handleInputChange}
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Contact Number"
                                id="mobileNo"
                                value={editUserData.mobileNo || ''}
                                onChange={handleInputChange}
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Date of Birth"
                                id="dob"
                                type="date"
                                value={editUserData.dob || ''}
                                onChange={handleInputChange}
                                margin="normal"
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl component="fieldset" margin="normal">
                                <FormLabel component="legend">Gender</FormLabel>
                                <RadioGroup
                                    row
                                    aria-label="gender"
                                    name="gender"
                                    value={editUserData.gender || ''}
                                    onChange={(e) => setEditUserData({...editUserData, gender: e.target.value})}
                                >
                                    <FormControlLabel value="male" control={<Radio />} label="Male" />
                                    <FormControlLabel value="female" control={<Radio />} label="Female" />
                                </RadioGroup>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Password"
                                id="password"
                                type="password"
                                value={editUserData.password || ''}
                                onChange={handleInputChange}
                                margin="normal"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setOpenEditDialog(false)} 
                        disabled={isUpdating}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleUpdateUser}
                        disabled={isUpdating}
                        startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                        {isUpdating ? 'Updating...' : 'Update'}
                    </Button>
                </DialogActions>
            </Dialog>
            
            {/* Delete Confirmation Dialog */}
            <Dialog open={openDeleteDialog} onClose={() => !isDeleting && setOpenDeleteDialog(false)}>
                <DialogTitle>Delete User Confirmation</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>{selectedUser?.email}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setOpenDeleteDialog(false)} 
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="contained" 
                        color="error" 
                        onClick={handleDeleteUser}
                        disabled={isDeleting}
                        startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
            {Constants.TOAST_CONTAINER}
        </Container>
    );
};

export default UsersData;