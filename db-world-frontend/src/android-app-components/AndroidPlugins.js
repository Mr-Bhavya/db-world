import { registerPlugin } from '@capacitor/core';
import MyDownloadManagerWeb from './MyDownloadManagerWeb';

const MyMedia3Player = registerPlugin('MyMedia3Player');
const MyDownloadManager = registerPlugin('MyDownloadManager', {
  web: () => new MyDownloadManagerWeb(),
});

export default {
  MyMedia3Player,
  MyDownloadManager
};
