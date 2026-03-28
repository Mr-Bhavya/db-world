import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Constants from "../Constants";
import { 
  Card, 
  CardHeader, 
  CardContent, 
  Typography, 
  Button, 
  Divider,
  Box,
  useTheme,
  Container,
  Grid,
  Chip,
  alpha,
  useMediaQuery
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock as LockIcon,
  VpnKey as KeyIcon,
  Visibility as ViewIcon,
  AddCircle as AddIcon,
  Security as SecurityIcon,
  // Encryption as EncryptionIcon,
  Shield as ShieldIcon,
  ArrowForward as ArrowIcon,
  Star as StarIcon,
  CheckCircle as CheckIcon,
  FiberSmartRecord as ParticleIcon
} from "@mui/icons-material";

// Advanced Background Component
const AdvancedBackground = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        overflow: 'hidden',
        background: `linear-gradient(135deg, 
          ${alpha('#000428', 0.95)} 0%, 
          ${alpha('#004e92', 0.9)} 50%, 
          ${alpha('#000428', 0.95)} 100%)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 15% 20%, ${alpha('#00bfa5', 0.15)} 0%, transparent 25%),
            radial-gradient(circle at 85% 30%, ${alpha('#2196f3', 0.15)} 0%, transparent 25%),
            radial-gradient(circle at 25% 80%, ${alpha('#ff6b6b', 0.1)} 0%, transparent 20%),
            radial-gradient(circle at 75% 75%, ${alpha('#ffa726', 0.1)} 0%, transparent 20%),
            radial-gradient(circle at 50% 50%, ${alpha('#4db6ac', 0.05)} 0%, transparent 30%)
          `,
          animation: 'pulse 8s ease-in-out infinite alternate'
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            linear-gradient(45deg, transparent 48%, ${alpha('#00bfa5', 0.03)} 50%, transparent 52%) 0 0 / 50px 50px,
            linear-gradient(-45deg, transparent 48%, ${alpha('#2196f3', 0.03)} 50%, transparent 52%) 0 0 / 50px 50px
          `,
          animation: 'moveBackground 20s linear infinite'
        }
      }}
    >
      {/* Animated Particles */}
      {[...Array(isMobile ? 15 : 30)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            background: [
              alpha('#00bfa5', 0.6),
              alpha('#2196f3', 0.6),
              alpha('#ff6b6b', 0.6),
              alpha('#ffa726', 0.6)
            ][i % 4],
            borderRadius: '50%',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
      
      {/* Floating Security Icons */}
      {[...Array(isMobile ? 3 : 6)].map((_, i) => (
        <motion.div
          key={`icon-${i}`}
          style={{
            position: 'absolute',
            color: alpha(['#00bfa5', '#2196f3', '#ff6b6b', '#ffa726'][i % 4], 0.1),
            fontSize: isMobile ? '2rem' : '4rem',
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 80 + 10}%`,
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <ParticleIcon fontSize="inherit" />
        </motion.div>
      ))}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes moveBackground {
          0% { background-position: 0 0; }
          100% { background-position: 50px 50px; }
        }
      `}</style>
    </Box>
  );
};

const cardVariants = {
  offscreen: {
    y: 60,
    opacity: 0,
    scale: 0.9
  },
  onscreen: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      duration: 0.8
    }
  },
  hover: {
    y: -10,
    scale: 1.02,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

function PasswordManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [hoveredCard, setHoveredCard] = useState(null);

  const features = [
    {
      title: "Generate Password",
      description: "Create strong, cryptographically secure passwords with customizable requirements including length, special characters, numbers, and case sensitivity. Our algorithm ensures maximum security.",
      icon: <KeyIcon fontSize="large" />,
      route: Constants.DB_GENERATE_PASSWORD_ROUTE,
      buttonText: "Generate Secure Password",
      buttonIcon: <KeyIcon />,
      color: "#00bfa5",
      badges: ["AES-256", "Customizable", "Secure"],
      stats: "100K+ Generated"
    },
    {
      title: "Save Password Securely",
      description: "Store your credentials safely in our military-grade encrypted database using AES-256 encryption. Your data is protected with multiple layers of security and regular security audits.",
      icon: <AddIcon fontSize="large" />,
      route: Constants.DB_ADD_PASSWORD_ROUTE,
      buttonText: "Save Credentials",
      buttonIcon: <LockIcon />,
      color: "#2196f3",
      badges: ["Military Grade", "Encrypted", "Backed Up"],
      stats: "99.9% Uptime"
    },
    {
      title: "View Saved Passwords",
      description: "Access your stored passwords securely with zero-knowledge architecture. Your encryption key is required for decryption, ensuring only you can access your sensitive data.",
      icon: <ViewIcon fontSize="large" />,
      route: Constants.DB_VIEW_PASSWORD_ROUTE,
      buttonText: "View Passwords",
      buttonIcon: <ViewIcon />,
      color: "#ff6b6b",
      badges: ["Zero-Knowledge", "Secure Access", "Encrypted"],
      stats: "Zero Breaches"
    }
  ];

  const securityFeatures = [
    { icon: <ShieldIcon />, text: "Military Grade Encryption", color: "#00bfa5" },
    // { icon: <EncryptionIcon />, text: "Zero-Knowledge Architecture", color: "#2196f3" },
    { icon: <SecurityIcon />, text: "Regular Security Audits", color: "#ff6b6b" },
    { icon: <LockIcon />, text: "Multi-Factor Authentication Ready", color: "#ffa726" }
  ];

  return (
    <Box sx={{ 
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Advanced Background */}
      <AdvancedBackground />

      {/* Main Content */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Container 
          maxWidth="lg" 
          sx={{ 
            py: { xs: 4, sm: 6, md: 8 },
            px: { xs: 2, sm: 3, md: 4 }
          }}
        >
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
          >
            <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: 'center',
                    gap: { xs: 2, sm: 3 },
                    mb: 3,
                    p: { xs: 2, sm: 3 },
                    borderRadius: 4,
                    background: alpha('#1a1a1a', 0.8),
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${alpha('#00bfa5', 0.2)}`,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    maxWidth: '100%'
                  }}
                >
                  <Box
                    sx={{
                      width: { xs: 60, sm: 80 },
                      height: { xs: 60, sm: 80 },
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, #00bfa5 0%, #2196f3 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `3px solid ${alpha('#00bfa5', 0.3)}`,
                      flexShrink: 0
                    }}
                  >
                    <SecurityIcon sx={{ fontSize: { xs: 30, sm: 40 }, color: 'white' }} />
                  </Box>
                  <Box textAlign={{ xs: 'center', sm: 'left' }}>
                    <Typography 
                      variant={isMobile ? "h3" : "h2"}
                      component="h1"
                      gutterBottom
                      sx={{
                        fontWeight: 800,
                        background: `linear-gradient(135deg, #00bfa5 0%, #2196f3 100%)`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' }
                      }}
                    >
                      Password Vault
                    </Typography>
                    <Typography 
                      variant={isMobile ? "body1" : "h6"}
                      color="grey.300"
                      sx={{ 
                        maxWidth: 600,
                        fontSize: { xs: '0.9rem', sm: '1rem' }
                      }}
                    >
                      Enterprise-grade password management with military-grade encryption and zero-knowledge security
                    </Typography>
                  </Box>
                </Box>
              </motion.div>

              {/* Security Features */}
              <Grid container spacing={2} justifyContent="center" sx={{ mt: 4 }}>
                {securityFeatures.map((feature, index) => (
                  <Grid item xs={12} sm={6} md={3} key={feature.text}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 + 0.5 }}
                    >
                      <Chip
                        icon={feature.icon}
                        label={isMobile ? feature.text.split(' ')[0] + '...' : feature.text}
                        sx={{
                          background: alpha(feature.color, 0.1),
                          color: feature.color,
                          border: `1px solid ${alpha(feature.color, 0.3)}`,
                          fontWeight: 600,
                          py: { xs: 1, sm: 2 },
                          px: 1,
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          '& .MuiChip-icon': { color: feature.color }
                        }}
                      />
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Grid container spacing={{ xs: 3, md: 4 }}>
              {features.map((feature, index) => (
                <Grid item xs={12} md={4} key={feature.title}>
                  <motion.div
                    variants={cardVariants}
                    whileHover="hover"
                    onHoverStart={() => setHoveredCard(feature.title)}
                    onHoverEnd={() => setHoveredCard(null)}
                  >
                    <Card
                      sx={{
                        height: '100%',
                        background: alpha('#1a1a1a', 0.85),
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${alpha(feature.color, 0.2)}`,
                        borderRadius: 4,
                        boxShadow: `0 8px 32px ${alpha(feature.color, 0.15)}`,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'visible',
                        position: 'relative',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(135deg, ${alpha(feature.color, 0.1)} 0%, transparent 50%)`,
                          borderRadius: 4,
                          opacity: hoveredCard === feature.title ? 1 : 0,
                          transition: 'opacity 0.3s ease'
                        }
                      }}
                    >
                      <CardContent sx={{ 
                        p: { xs: 3, sm: 4 }, 
                        height: '100%', 
                        display: 'flex', 
                        flexDirection: 'column' 
                      }}>
                        {/* Icon and Header */}
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                          >
                            <Box
                              sx={{
                                width: { xs: 60, sm: 80 },
                                height: { xs: 60, sm: 80 },
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${feature.color} 0%, ${alpha(feature.color, 0.7)} 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px',
                                border: `2px solid ${alpha(feature.color, 0.3)}`,
                                boxShadow: `0 8px 32px ${alpha(feature.color, 0.3)}`
                              }}
                            >
                              {React.cloneElement(feature.icon, {
                                sx: { 
                                  fontSize: { xs: 24, sm: 32 }, 
                                  color: 'white' 
                                }
                              })}
                            </Box>
                          </motion.div>
                          
                          <Typography 
                            variant={isMobile ? "h6" : "h5"}
                            component="h2"
                            gutterBottom
                            sx={{ 
                              fontWeight: 700,
                              color: feature.color,
                              fontSize: { xs: '1.25rem', sm: '1.5rem' }
                            }}
                          >
                            {feature.title}
                          </Typography>

                          {/* Stats Chip */}
                          <Chip
                            icon={<CheckIcon />}
                            label={feature.stats}
                            size="small"
                            sx={{
                              background: alpha(feature.color, 0.1),
                              color: feature.color,
                              fontWeight: 600,
                              mb: 2,
                              fontSize: { xs: '0.7rem', sm: '0.8rem' }
                            }}
                          />
                        </Box>

                        {/* Description */}
                        <Typography 
                          variant="body2"
                          color="grey.400"
                          paragraph
                          sx={{ 
                            flex: 1,
                            lineHeight: 1.6,
                            fontSize: { xs: '0.85rem', sm: '0.95rem' }
                          }}
                        >
                          {feature.description}
                        </Typography>

                        {/* Badges */}
                        <Box sx={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: 1, 
                          mb: 3,
                          justifyContent: 'center'
                        }}>
                          {feature.badges.map((badge) => (
                            <Chip
                              key={badge}
                              label={badge}
                              size="small"
                              variant="outlined"
                              sx={{
                                borderColor: alpha(feature.color, 0.3),
                                color: feature.color,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                fontWeight: 600
                              }}
                            />
                          ))}
                        </Box>

                        {/* Action Button */}
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            component={Link}
                            to={feature.route}
                            variant="contained"
                            startIcon={feature.buttonIcon}
                            endIcon={<ArrowIcon />}
                            fullWidth
                            sx={{
                              background: `linear-gradient(135deg, ${feature.color} 0%, ${alpha(feature.color, 0.8)} 100%)`,
                              borderRadius: 3,
                              py: { xs: 1.25, sm: 1.5 },
                              fontWeight: 600,
                              textTransform: 'none',
                              fontSize: { xs: '0.875rem', sm: '1rem' },
                              boxShadow: `0 4px 20px ${alpha(feature.color, 0.3)}`,
                              '&:hover': {
                                background: `linear-gradient(135deg, ${alpha(feature.color, 0.9)} 0%, ${alpha(feature.color, 0.7)} 100%)`,
                                boxShadow: `0 8px 32px ${alpha(feature.color, 0.4)}`,
                                transform: 'translateY(-2px)'
                              }
                            }}
                          >
                            {isMobile ? feature.buttonText.split(' ')[0] + '...' : feature.buttonText}
                          </Button>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>

          {/* Footer Security Note */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <Box sx={{ textAlign: 'center', mt: { xs: 6, md: 8 } }}>
              <Card
                sx={{
                  background: alpha('#1a1a1a', 0.8),
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha('#00bfa5', 0.2)}`,
                  borderRadius: 3,
                  p: { xs: 2, sm: 3 }
                }}
              >
                <Typography 
                  variant="body2" 
                  color="grey.400" 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 1,
                    flexWrap: 'wrap'
                  }}
                >
                  <ShieldIcon color="success" fontSize="small" />
                  Your data is encrypted end-to-end and never stored in plain text
                  <StarIcon color="warning" fontSize="small" />
                </Typography>
              </Card>
            </Box>
          </motion.div>
        </Container>
      </Box>
    </Box>
  );
}

export default PasswordManagement;