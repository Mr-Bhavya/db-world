import React, { Suspense } from "react";

// Lazy-loading logic for images
const LazyImage = ({ src, alt, className, style, skeleton, horizontal, ...rest }) => {
  return (
    <Suspense
      fallback={
        skeleton
      }
    >
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
      />
    </Suspense>
  );
};

export default LazyImage;