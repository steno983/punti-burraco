import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/**
 * Icona: fondo scuro, disco verde, carta bianca al centro.
 *
 * Le proporzioni di default (`discRadiusFactor` 0.42) disegnano il soggetto
 * fino quasi al bordo, adatto alle icone "any". Per le icone "maskable" i
 * launcher Android possono ritagliare qualunque cosa fuori dalla zona sicura
 * (un cerchio centrato di raggio 0.4 rispetto al lato): passare fattori più
 * piccoli (vedi `iconPixelsMaskable`) tiene il soggetto dentro quella zona,
 * mentre lo sfondo continua a coprire l'intero riquadro.
 */
function iconPixels(size, { discRadiusFactor = 0.42, cardWidthFactor = 0.22, cardHeightFactor = 0.32 } = {}) {
  const rows = []
  const center = size / 2
  const discRadius = size * discRadiusFactor
  const cardWidth = size * cardWidthFactor
  const cardHeight = size * cardHeightFactor

  for (let y = 0; y < size; y++) {
    const row = [0]
    for (let x = 0; x < size; x++) {
      const dx = x - center
      const dy = y - center
      const insideDisc = dx * dx + dy * dy <= discRadius * discRadius
      const insideCard = Math.abs(dx) <= cardWidth / 2 && Math.abs(dy) <= cardHeight / 2

      if (insideCard) row.push(0xf8, 0xfa, 0xfc, 0xff)
      else if (insideDisc) row.push(0x22, 0xc5, 0x5e, 0xff)
      else row.push(0x0f, 0x17, 0x2a, 0xff)
    }
    rows.push(Buffer.from(row))
  }
  return Buffer.concat(rows)
}

/** Stessa icona, ma ridimensionata perché il soggetto stia nella zona sicura "maskable". */
function iconPixelsMaskable(size) {
  return iconPixels(size, { discRadiusFactor: 0.36, cardWidthFactor: 0.19, cardHeightFactor: 0.27 })
}

function png(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [size, name, pixels] of [
  [192, 'public/icon-192.png', iconPixels(192)],
  [512, 'public/icon-512.png', iconPixels(512)],
  [180, 'public/apple-touch-icon.png', iconPixels(180)],
  [512, 'public/icon-512-maskable.png', iconPixelsMaskable(512)],
]) {
  writeFileSync(name, png(size, pixels))
  console.log(`Creata ${name}`)
}
