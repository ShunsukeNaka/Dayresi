import qrcode from 'qrcode-generator'

/**
 * スマホの画面に出した QR を、スマホのカメラで確実に読める大きさの上限（バージョン 25、117 × 117 の点）
 * これより大きくなるデータは QR にせず、リンクで送ってもらう（spec-next.md「会計を送る」）
 */
export const MAX_QR_VERSION = 25

/**
 * 文字列を QR の点の並び（true が黒）にする。上限を超えるときは null
 * 誤り訂正は、入る量が一番多いレベル L にする（画面に出すので汚れや欠けは考えなくてよい）
 */
export function qrModules(text: string): boolean[][] | null {
  for (let version = 1; version <= MAX_QR_VERSION; version++) {
    const qr = qrcode(version as Parameters<typeof qrcode>[0], 'L')
    qr.addData(text, 'Byte')
    try {
      qr.make()
    } catch {
      continue // このバージョンには入らない
    }
    const n = qr.getModuleCount()
    return Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => qr.isDark(row, col)))
  }
  return null
}
