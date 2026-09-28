/**
 * Feasibility probe: the `docx` library bundled in a single HTML file with the
 * production CSP, loaded lazily (dynamic import inlined), generating a .docx
 * with text, a table, a landscape section and a PNG image.
 */
const button = document.getElementById('run') as HTMLButtonElement
const result = document.getElementById('result') as HTMLPreElement

async function pngBytes(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 200
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#004e9f'
  context.fillRect(0, 0, 400, 200)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('png'))
    }, 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

button.addEventListener('click', () => {
  void (async () => {
    const started = performance.now()
    try {
      const docx = await import('docx')
      const loadedMs = Math.round(performance.now() - started)
      const image = await pngBytes()
      const doc = new docx.Document({
        sections: [
          {
            children: [
              new docx.Paragraph({ heading: docx.HeadingLevel.HEADING_1, text: 'Entrepôt Lyon' }),
              new docx.Paragraph({
                children: [
                  new docx.ImageRun({
                    type: 'png',
                    data: image,
                    transformation: { width: 400, height: 200 },
                  }),
                ],
              }),
              new docx.Table({
                rows: [
                  new docx.TableRow({
                    children: [
                      new docx.TableCell({ children: [new docx.Paragraph('Total général')] }),
                    ],
                  }),
                ],
              }),
            ],
          },
          {
            properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE } } },
            children: [new docx.Paragraph('Plan')],
          },
        ],
      })
      const blob = await docx.Packer.toBlob(doc)
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
      result.textContent = JSON.stringify({
        ok: true,
        zip: head[0] === 0x50 && head[1] === 0x4b,
        bytes: blob.size,
        type: blob.type,
        loadedMs,
        ms: Math.round(performance.now() - started),
      })
    } catch (error) {
      result.textContent = JSON.stringify({
        ok: false,
        error: String(error),
        stack: (error as Error).stack,
      })
    }
  })()
})
