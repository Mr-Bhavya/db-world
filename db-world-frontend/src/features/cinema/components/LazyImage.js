import React, { Suspense } from "react";

// Lazy-loading logic for images
const LazyImage = ({ src, alt, className, style, skeleton, horizontal, handleError ,...rest }) => {
  return (
    <Suspense
      fallback={
        skeleton
      }
      name={alt}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        onError={handleError}
      />
    </Suspense>
  );
};

export default LazyImage;