type Props = {
  /** QR の点の並び（true が黒）。src/lib/qr.ts の qrModules で作る */
  modules: boolean[][]
  label: string
}

/** QR コードを SVG で描く。周りに 4 点分の白い余白を付ける（QR の決まり） */
export function QrCode({ modules, label }: Props) {
  const n = modules.length
  const margin = 4
  let d = ''
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) d += `M${x + margin} ${y + margin}h1v1h-1z`
  }))
  return (
    <svg className="qr" viewBox={`0 0 ${n + margin * 2} ${n + margin * 2}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  )
}
