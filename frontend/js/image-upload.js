// Shrink before uploading so the original camera photo never crosses the network.
async function compressUpload(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("Das Bild hat zu viele Pixel (maximal 40 Megapixel).");
    }
    const scale = Math.min(1, 400 / image.naturalWidth, 400 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bildverarbeitung ist in diesem Browser nicht verfügbar.");
    let blob;
    for (;;) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob) throw new Error("Das Bild konnte nicht verarbeitet werden.");
        if (blob.size <= 30 * 1024) break;
      }
      if (blob.size <= 30 * 1024) break;
      canvas.width = Math.max(1, Math.round(canvas.width * 0.85));
      canvas.height = Math.max(1, Math.round(canvas.height * 0.85));
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden."));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (error.name === "EncodingError") throw new Error("Das Bild konnte nicht gelesen werden.");
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
