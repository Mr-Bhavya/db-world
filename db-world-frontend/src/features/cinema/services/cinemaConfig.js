import { useEffect, useRef, useState } from "react";

// Helper function to create tiles configuration
export const createTilesConfig = (configs) => {
  return configs.map(config => ({
    title: config.title,
    requestUrl: config.requestUrl,
    horizontal: config.horizontal || false,
    recordTypes: config.recordTypes || ['movie', 'series'],
    ...config
  }));
};

// Pre-configured pages
export const createHomePageConfig = () => createTilesConfig([
  {
    title: "Trending Now",
    requestUrl: "trending",
    horizontal: true,
    recordTypes: ['movie', 'series']
  },
  {
    title: "Popular Movies",
    requestUrl: "popular-movies",
    horizontal: true,
    recordTypes: ['movie']
  },
  {
    title: "Popular TV Shows",
    requestUrl: "popular-series",
    horizontal: true,
    recordTypes: ['series']
  },
  {
    title: "New Releases",
    requestUrl: "new-releases",
    horizontal: true,
    recordTypes: ['movie', 'series']
  }
]);

export const createMoviesPageConfig = () => createTilesConfig([
  {
    title: "Popular Movies",
    requestUrl: "popular-movies",
    horizontal: true,
    recordTypes: ['movie']
  },
  {
    title: "Top Rated Movies",
    requestUrl: "top-rated-movies",
    horizontal: true,
    recordTypes: ['movie']
  },
  {
    title: "Now Playing",
    requestUrl: "now-playing-movies",
    horizontal: true,
    recordTypes: ['movie']
  },
  {
    title: "Upcoming Movies",
    requestUrl: "upcoming-movies",
    horizontal: true,
    recordTypes: ['movie']
  }
]);

export const createSeriesPageConfig = () => createTilesConfig([
  {
    title: "Popular TV Shows",
    requestUrl: "popular-series",
    horizontal: true,
    recordTypes: ['series']
  },
  {
    title: "Top Rated TV Shows",
    requestUrl: "top-rated-series",
    horizontal: true,
    recordTypes: ['series']
  },
  {
    title: "Airing Today",
    requestUrl: "airing-today",
    horizontal: true,
    recordTypes: ['series']
  },
  {
    title: "On The Air",
    requestUrl: "on-the-air",
    horizontal: true,
    recordTypes: ['series']
  }
]);

export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      root: null,
      rootMargin: '300px',
      threshold: 0.01,
      ...options
    });
    
    const currentRef = ref.current;
    
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]);
  
  return [ref, isIntersecting];
};