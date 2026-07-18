function csvError(label, message) {
  return new Error(`${label}: ${message}`);
}

export function parseCsv(text, label = "CSV") {
  const records = [];
  let row = [];
  let cell = "";
  let inQuotedField = false;
  let afterQuotedField = false;
  let recordNumber = 1;

  const finishCell = () => {
    row.push(cell);
    cell = "";
    afterQuotedField = false;
  };
  const finishRecord = () => {
    finishCell();
    if (row.length !== 1 || row[0] !== "") records.push({ recordNumber, values: row });
    row = [];
    recordNumber += 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotedField) {
      if (character !== '"') {
        cell += character;
      } else if (text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotedField = false;
        afterQuotedField = true;
      }
      continue;
    }

    if (afterQuotedField) {
      if (character === ",") {
        finishCell();
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        finishRecord();
      } else {
        throw csvError(label, `illegal character after quoted field in row ${recordNumber}`);
      }
      continue;
    }

    if (character === '"') {
      if (cell.length > 0) throw csvError(label, `illegal quote in row ${recordNumber}`);
      inQuotedField = true;
    } else if (character === ",") {
      finishCell();
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRecord();
    } else {
      cell += character;
    }
  }

  if (inQuotedField) throw csvError(label, `unterminated quoted field in row ${recordNumber}`);
  if (afterQuotedField || cell.length > 0 || row.length > 0) finishRecord();
  if (records.length === 0) throw csvError(label, "missing header row");

  const [{ values: rawHeaders }, ...body] = records;
  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/u, "") : header,
  );
  if (headers.some((header) => header.length === 0)) throw csvError(label, "blank header");
  const uniqueHeaders = new Set(headers);
  if (uniqueHeaders.size !== headers.length) {
    const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
    throw csvError(label, `duplicate header ${duplicate}`);
  }

  const rows = body.map(({ recordNumber: number, values }) => {
    if (values.length !== headers.length) {
      throw csvError(label, `row ${number} has ${values.length} columns; expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });

  return { headers, rows };
}
