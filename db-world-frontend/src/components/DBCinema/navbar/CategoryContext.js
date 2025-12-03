// contexts/CategoryContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const CategoryContext = createContext();

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};

export const CategoryProvider = ({ children }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedNav, setSelectedNav] = useState(null);

  const selectCategory = useCallback((category) => {
    console.log("Context: Selecting category", category);
    setSelectedCategory(category);
  }, []);

  const clearCategory = useCallback(() => {
    console.log("Context: Clearing category");
    setSelectedCategory(null);
  }, []);

  const selectNav = useCallback((navItem) => {
    console.log("Context: Selecting nav", navItem);
    setSelectedNav(navItem);
  }, []);

  const clearNav = useCallback(() => {
    console.log("Context: Clearing nav");
    setSelectedNav(null);
  }, []);

  const value = {
    // State
    selectedCategory,
    selectedNav,
    
    // Actions
    selectCategory,
    clearCategory,
    selectNav,
    clearNav,
    
    // Combined actions
    setCategory: selectCategory,
    setNav: selectNav,
    reset: () => {
      clearCategory();
      clearNav();
    }
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};