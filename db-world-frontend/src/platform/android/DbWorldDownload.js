import { registerPlugin } from '@capacitor/core';
import MyDownloadManagerWeb from './MyDownloadManagerWeb';

const DbWorldDownload = registerPlugin('DbWorldDownload', {
  web: () => new MyDownloadManagerWeb(),
});

export async function openDownloadedFile(download) {
  const uri = download?.localUri || download?.playableUri;
  if (!uri) throw new Error('The saved file location is unavailable. Download the file again.');
  return DbWorldDownload.openFile({ uri, mimeType: download.mimeType || '' });
}

export default DbWorldDownload;
