/**
 * IPO's company logo is now the shared BrandLogo. Kept as a thin re-export so
 * existing IPO imports (`CompanyLogo`, `resolveLogoSrc`) and the unit test keep
 * working unchanged.
 */
import BrandLogo, { resolveLogoSrc } from '@shared/brand/BrandLogo';

export { resolveLogoSrc };
export default BrandLogo;
