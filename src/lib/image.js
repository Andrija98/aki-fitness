// Smanjivanje fotografije pre slanja, u browseru (canvas), bez biblioteke.
// Telefon pravi 4–8 MB; posle ovoga je obično 200–400 KB, što štedi prostor u bazi i mobilni internet.

export const MAX_SIDE = 1600;
const QUALITY = 0.8;

// Vraća JPEG Blob. Baca grešku ako browser ne ume da pročita format (npr. HEIC na računaru).
export async function compressImage(file, maxSide = MAX_SIDE) {
  // imageOrientation: 'from-image' poštuje EXIF rotaciju, inače bi uspravna slika sa telefona bila položena.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Slika nije obrađena.');
  return blob;
}
