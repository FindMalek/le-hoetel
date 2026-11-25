const DELIMITERS = [",", ";", "\t"] as const

/** Excel in French locales saves with `;`, so the delimiter is the most common one in the header line. */
function detectDelimiter(text: string): string {
  const header = text.slice(0, text.search(/\r?\n/) === -1 ? undefined : text.search(/\r?\n/))
  return DELIMITERS.reduce((best, d) => (header.split(d).length > header.split(best).length ? d : best), ",")
}

/** RFC 4180 rows: quoted cells, `""` escapes, newlines inside quotes, a BOM and blank lines are handled. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "")
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const endCell = () => {
    row.push(cell)
    cell = ""
  }
  const endRow = () => {
    endCell()
    if (row.some((value) => value.trim() !== "")) rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) endCell()
    else if (char === "\n") endRow()
    else if (char !== "\r") cell += char
  }
  endRow()
  return rows
}

/** A cell a spreadsheet would run as a formula gets a leading quote, so a downloaded report can't execute guest input. */
const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((value) => `"${safe(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")
}
