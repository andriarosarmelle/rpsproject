export type ParsedCsvDocument = {
  headers: string[];
  rows: Array<Record<string, string>>;
  dataLineCount: number;
};

export function normalizeCsvHeader(header: string) {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function splitCsvLine(line: string): string[] {
  return splitCsvLineWithDelimiter(line, ',');
}

export function detectCsvDelimiter(line: string) {
  const supportedDelimiters = [',', ';', '\t'] as const;
  let bestDelimiter: (typeof supportedDelimiters)[number] =
    supportedDelimiters[0];
  let bestCount = -1;

  for (const delimiter of supportedDelimiters) {
    let count = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === delimiter) {
        count += 1;
      }
    }

    if (count > bestCount) {
      bestDelimiter = delimiter;
      bestCount = count;
    }
  }

  return bestDelimiter;
}

export function splitCsvLineWithDelimiter(
  line: string,
  delimiter: ',' | ';' | '\t',
): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvDocument(
  csv: string,
  normalizeHeader: (header: string) => string = normalizeCsvHeader,
): ParsedCsvDocument {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      headers: [],
      rows: [],
      dataLineCount: 0,
    };
  }

  const [headerLine, ...dataLines] = lines;
  const delimiter = detectCsvDelimiter(headerLine);
  const headers = splitCsvLineWithDelimiter(headerLine, delimiter).map(
    normalizeHeader,
  );
  const rows = dataLines.map((line) => {
    const values = splitCsvLineWithDelimiter(line, delimiter);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });

  return {
    headers,
    rows,
    dataLineCount: dataLines.length,
  };
}
