// Returns a color string for the file type icon
export function getFileColor(item) {
  if (item.directory) return '#f59e0b';
  const ext = (item.extension || '').toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(ext)) return '#6366f1';
  if (['mp3','flac','aac','wav','ogg'].includes(ext)) return '#10b981';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '#f43f5e';
  if (['pdf'].includes(ext)) return '#ef4444';
  if (['zip','tar','gz','rar','7z'].includes(ext)) return '#f97316';
  if (['js','ts','jsx','tsx','py','java','go','rs'].includes(ext)) return '#3b82f6';
  if (['txt','md','log'].includes(ext)) return '#94a3b8';
  return '#64748b';
}

// Returns an emoji icon for the file type
export function getFileEmoji(item) {
  if (item.directory) return '📁';
  const ext = (item.extension || '').toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(ext)) return '🎬';
  if (['mp3','flac','aac','wav','ogg'].includes(ext)) return '🎵';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['zip','tar','gz','rar','7z'].includes(ext)) return '📦';
  if (['js','ts','jsx','tsx','py','java','go','rs'].includes(ext)) return '💻';
  if (['txt','md','log'].includes(ext)) return '📝';
  return '📄';
}
