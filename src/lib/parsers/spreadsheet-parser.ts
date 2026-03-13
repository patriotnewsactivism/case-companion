import * as XLSX from 'xlsx';

export interface SpreadsheetResult {
  text: string;
  sheets: Array<{
    name: string;
    rows: number;
    columns: number;
    data: any[][];
  }>;
}

export async function parseSpreadsheet(file: File): Promise<SpreadsheetResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  let fullText = '';
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const text = XLSX.utils.sheet_to_csv(sheet);
    fullText += `\n--- Sheet: ${name} ---\n${text}\n`;
    
    return {
      name,
      rows: data.length,
      columns: data[0]?.length || 0,
      data,
    };
  });
  
  return { text: fullText.trim(), sheets };
}
