import { registerPlugin } from '@capacitor/core';
import MyDownloadManagerWeb from './MyDownloadManagerWeb';

const DbWorldDownload = registerPlugin('DbWorldDownload', {
  web: () => new MyDownloadManagerWeb(),
});

export default DbWorldDownload;
