/**
 * Publishable Logo.dev token — now lives in the shared brand module. Re-exported
 * here so existing IPO imports (`import { LOGODEV_TOKEN } from '../config'`) and
 * the CompanyLogo unit test keep resolving unchanged.
 */
export { LOGODEV_TOKEN } from '@shared/brand/logoDev';
