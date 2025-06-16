import React from "react";
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
  useTheme
} from "@mui/material";
import { motion } from "framer-motion";
import { 
  Lock as LockIcon,
  VpnKey as KeyIcon,
  Visibility as ViewIcon,
  AddCircle as AddIcon
} from "@mui/icons-material";

const cardVariants = {
  offscreen: {
    y: 50,
    opacity: 0
  },
  onscreen: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      bounce: 0.4,
      duration: 0.8
    }
  }
};

function PasswordManagement() {
  const theme = useTheme();

  const features = [
    {
      title: "Generate Password",
      description: "Create strong passwords with customizable requirements including length, special characters, and case sensitivity.",
      icon: <KeyIcon color="primary" fontSize="large" />,
      route: Constants.DB_GENERATE_PASSWORD_ROUTE,
      buttonText: "Generate Password",
      buttonIcon: <KeyIcon />
    },
    {
      title: "Save Password Securely",
      description: "Store your credentials safely in our database using AES-256 encryption for maximum security.",
      icon: <AddIcon color="primary" fontSize="large" />,
      route: Constants.DB_ADD_PASSWORD_ROUTE,
      buttonText: "Save Credentials",
      buttonIcon: <LockIcon />
    },
    {
      title: "View Saved Passwords",
      description: "Access your stored passwords securely by providing your encryption key when needed.",
      icon: <ViewIcon color="primary" fontSize="large" />,
      route: Constants.DB_VIEW_PASSWORD_ROUTE,
      buttonText: "View Passwords",
      buttonIcon: <ViewIcon />
    }
  ];

  return (
    <Box sx={{ 
      maxWidth: 800, 
      mx: 'auto', 
      my: 4,
      px: 2
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <CardHeader
          title={
            <Typography 
              variant="h3" 
              component="h1" 
              align="center" 
              gutterBottom
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
                textShadow: '1px 1px 2px rgba(0,0,0,0.9)'
              }}
            >
              Password Management
            </Typography>
          }
          sx={{ 
            py: 4,
            background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.paper} 100%)`,
            borderRadius: 1,
            mb: 3
          }}
        />
      </motion.div>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial="offscreen"
            whileInView="onscreen"
            viewport={{ once: true, amount: 0.2 }}
            variants={cardVariants}
            custom={index}
          >
            <Card
              sx={{
                borderRadius: 2,
                boxShadow: 3,
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: 6
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {feature.icon}
                  <Typography 
                    variant="h5" 
                    component="h2" 
                    sx={{ 
                      ml: 2,
                      fontWeight: 600,
                      color: theme.palette.text.primary
                    }}
                  >
                    {feature.title}
                  </Typography>
                </Box>
                
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  paragraph
                  sx={{ mb: 3 }}
                >
                  {feature.description}
                </Typography>
                
                <Button
                  component={Link}
                  to={feature.route}
                  variant="contained"
                  startIcon={feature.buttonIcon}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    fontWeight: 600,
                    textTransform: 'none',
                    letterSpacing: 0.5
                  }}
                >
                  {feature.buttonText}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Box>
    </Box>
  );
}

export default PasswordManagement;