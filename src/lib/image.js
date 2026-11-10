// Smanjivanje fotografije pre slanja, u browseru (canvas), bez biblioteke.
// Telefon pravi 4–8 MB; posle ovoga je obično 200–400 KB, što štedi prostor u bazi i mobilni internet.

export const MAX_SIDE = 1600;
const QUALITY = 0.8;

// Učitava sliku za crtanje. createImageBitmap je brži, a <img> je rezerva za starije browsere.
// Oba poštuju EXIF rotaciju, inače bi uspravna slika sa telefona bila položena.
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // probaj preko <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Vraća JPEG Blob. Baca grešku ako browser ne ume da pročita format (npr. HEIC na računaru).
export async function compressImage(file, maxSide = MAX_SIDE) {
  const source = await decode(file);
  const srcWidth = source.naturalWidth ?? source.width;
  const srcHeight = source.naturalHeight ?? source.height;
  const scale = Math.min(1, maxSide / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Slika nije obrađena.');
  return blob;
}
