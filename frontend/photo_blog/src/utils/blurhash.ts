import { decodeBlurHash } from 'fast-blurhash';

/** Decode and render a blurhash string onto a canvas element.
 * @param canvas - Target canvas element.
 * @param hash - Encoded blurhash string.
 * @param width - Source image width (clamped to 32px for decoding).
 * @param height - Source image height (clamped to 32px for decoding).
 */
export function drawBlurhash(canvas: HTMLCanvasElement, hash: string, width: number, height: number) {
  const renderW = Math.min(width, 32);
  const renderH = Math.min(height, 32);

  canvas.width = renderW;
  canvas.height = renderH;

  const pixels = decodeBlurHash(hash, renderW, renderH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(renderW, renderH);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
}
