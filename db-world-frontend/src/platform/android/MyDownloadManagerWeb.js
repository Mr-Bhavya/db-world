import { WebPlugin } from '@capacitor/core';

class MyDownloadManagerWeb extends WebPlugin {
  async startDownload(options) {
    const { url, fileName } = options;
    if (!url) {
      throw new Error("URL is required");
    }
    
    // For web, simulate a download by creating an anchor element and clicking it.
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName; // This sets the file name for download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Return a dummy downloadId for the web case.
    return { downloadId: 0 };
  }
}

export default MyDownloadManagerWeb;
