export function downloadFile(content: string, mimeType: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Let the browser consume the blob before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
