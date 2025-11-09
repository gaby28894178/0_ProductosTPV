const fs = require('fs');
const path = require('path');

function writeBase64Png(filePath, base64Data) {
  const buf = Buffer.from(base64Data, 'base64');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

// PNG 1x1 rojo
const RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YQXoFQAAAAASUVORK5CYII=';
// PNG 1x1 verde
const GREEN_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AAAAMBAQGJc3bqAAAAAElFTkSuQmCC';

const outDir = path.join(__dirname, '..', 'assets', 'product-images');
writeBase64Png(path.join(outDir, 'sample_rojo.png'), RED_PNG);
writeBase64Png(path.join(outDir, 'sample_verde.png'), GREEN_PNG);

console.log('Placeholders escritos en:', outDir);