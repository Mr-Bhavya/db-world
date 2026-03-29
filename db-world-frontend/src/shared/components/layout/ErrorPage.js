import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Constants from '@shared/constants';
import { motion } from "framer-motion";

function ErrorPage() {
    const navigate = useNavigate();
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20
            });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 12
            }
        }
    };

    const numberVariants = {
        hidden: { scale: 0.8, opacity: 0 },
        visible: {
            scale: 1,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 200,
                damping: 20
            }
        }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                padding: "20px",
                position: "relative",
                overflow: "hidden"
            }}
        >
            {/* Animated background elements */}
            <motion.div
                animate={{
                    x: mousePosition.x,
                    y: mousePosition.y
                }}
                transition={{ type: "spring", stiffness: 50, damping: 30 }}
                style={{
                    position: "absolute",
                    width: "400px",
                    height: "400px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
                    top: "10%",
                    left: "10%",
                    pointerEvents: "none"
                }}
            />
            <motion.div
                animate={{
                    x: -mousePosition.x,
                    y: -mousePosition.y
                }}
                transition={{ type: "spring", stiffness: 50, damping: 30 }}
                style={{
                    position: "absolute",
                    width: "300px",
                    height: "300px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)",
                    bottom: "10%",
                    right: "10%",
                    pointerEvents: "none"
                }}
            />

            {/* Main content card */}
            <motion.div
                variants={itemVariants}
                style={{
                    maxWidth: "600px",
                    width: "100%",
                    margin: "0 auto"
                }}
            >
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{
                        background: "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(10px)",
                        borderRadius: "24px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)",
                        padding: "48px 32px",
                        textAlign: "center",
                        position: "relative",
                        overflow: "hidden"
                    }}
                >
                    {/* Decorative line */}
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: "linear-gradient(90deg, #667eea, #764ba2, #667eea)",
                            transformOrigin: "left"
                        }}
                    />

                    {/* 404 Animation */}
                    <motion.div
                        variants={numberVariants}
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "24px"
                        }}
                    >
                        {[4, 0, 4].map((num, index) => (
                            <motion.div
                                key={index}
                                initial={{ y: -100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{
                                    delay: index * 0.1,
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 15
                                }}
                                whileHover={{
                                    scale: 1.1,
                                    rotate: [0, -5, 5, 0],
                                    transition: { duration: 0.3 }
                                }}
                                style={{
                                    fontSize: "80px",
                                    fontWeight: "800",
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    textShadow: "0 10px 20px rgba(102, 126, 234, 0.2)",
                                    lineHeight: 1
                                }}
                            >
                                {num}
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Title */}
                    <motion.h4
                        variants={itemVariants}
                        style={{
                            fontSize: "28px",
                            fontWeight: "700",
                            color: "#2d3748",
                            marginBottom: "16px",
                            letterSpacing: "-0.5px"
                        }}
                    >
                        Page Not Found
                    </motion.h4>

                    {/* Decorative divider */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            width: "80px",
                            height: "4px",
                            background: "linear-gradient(90deg, #667eea, #764ba2)",
                            margin: "24px auto",
                            borderRadius: "2px"
                        }}
                    />

                    {/* Message */}
                    <motion.div variants={itemVariants}>
                        <p style={{
                            fontSize: "16px",
                            color: "#4a5568",
                            lineHeight: "1.6",
                            marginBottom: "12px"
                        }}>
                            The page you're looking for doesn't exist or has been moved.
                        </p>
                        <p style={{
                            fontSize: "15px",
                            color: "#718096",
                            lineHeight: "1.6",
                            marginBottom: "16px"
                        }}>
                            If this is your first time visiting, please register first.
                            Otherwise, try logging in again.
                        </p>
                    </motion.div>

                    {/* Thank you message */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            margin: "24px 0",
                            padding: "12px",
                            background: "linear-gradient(135deg, #f6f9fc 0%, #edf2f7 100%)",
                            borderRadius: "12px",
                            color: "#4a5568",
                            fontWeight: "600"
                        }}
                    >
                        Thank You for Visiting! ✨
                    </motion.div>

                    {/* Action buttons */}
                    <motion.ul
                        variants={itemVariants}
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                            listStyle: "none",
                            padding: 0,
                            margin: "32px 0 0 0"
                        }}
                    >
                        <motion.li
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <motion.button
                                type="button"
                                onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                                style={{
                                    padding: "12px 28px",
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "50px",
                                    fontSize: "15px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    boxShadow: "0 10px 20px rgba(102, 126, 234, 0.3)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    transition: "all 0.3s ease"
                                }}
                                whileHover={{
                                    boxShadow: "0 15px 30px rgba(102, 126, 234, 0.4)"
                                }}
                            >
                                <span>🏠</span> Home
                            </motion.button>
                        </motion.li>

                        <motion.li
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Link to={Constants.REGISTRATION_ROUTE} style={{ textDecoration: "none" }}>
                                <motion.button
                                    type="button"
                                    style={{
                                        padding: "12px 28px",
                                        background: "linear-gradient(135deg, #4299e1 0%, #3182ce 100%)",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "50px",
                                        fontSize: "15px",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        boxShadow: "0 10px 20px rgba(66, 153, 225, 0.3)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px"
                                    }}
                                    whileHover={{
                                        boxShadow: "0 15px 30px rgba(66, 153, 225, 0.4)"
                                    }}
                                >
                                    <span>📝</span> Register
                                </motion.button>
                            </Link>
                        </motion.li>

                        <motion.li
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Link to={Constants.LOGIN_ROUTE} style={{ textDecoration: "none" }}>
                                <motion.button
                                    type="button"
                                    style={{
                                        padding: "12px 28px",
                                        background: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "50px",
                                        fontSize: "15px",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        boxShadow: "0 10px 20px rgba(72, 187, 120, 0.3)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px"
                                    }}
                                    whileHover={{
                                        boxShadow: "0 15px 30px rgba(72, 187, 120, 0.4)"
                                    }}
                                >
                                    <span>🔐</span> Login
                                </motion.button>
                            </Link>
                        </motion.li>
                    </motion.ul>

                    {/* Help text */}
                    <motion.p
                        variants={itemVariants}
                        style={{
                            marginTop: "32px",
                            fontSize: "14px",
                            color: "#a0aec0"
                        }}
                    >
                        Need help? <span style={{ color: "#667eea", cursor: "pointer" }}>Contact Support</span>
                    </motion.p>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}

export default ErrorPage;