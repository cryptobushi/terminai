/**
 * Shared file and image utility functions
 */

/**
 * Load an image from a URL or data URI
 * @param src - Image source URL or data URI
 * @returns Promise that resolves with the loaded image element
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Convert a File object to a data URI string
 * @param file - File to convert
 * @returns Promise that resolves with the data URI string
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
