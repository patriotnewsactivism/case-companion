import PostalMime from 'postal-mime';

export interface ParsedEmail {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    content: Uint8Array;
    size: number;
  }>;
  headers: Record<string, string>;
}

export async function parseEmail(file: File): Promise<ParsedEmail> {
  const arrayBuffer = await file.arrayBuffer();
  const parser = new PostalMime();
  const email = await parser.parse(arrayBuffer);
  
  return {
    from: email.from?.address || email.from?.name || 'Unknown',
    to: email.to?.map(t => t.address || t.name || '') || [],
    cc: email.cc?.map(t => t.address || t.name || '') || [],
    bcc: email.bcc?.map(t => t.address || t.name || '') || [],
    subject: email.subject || 'No Subject',
    date: email.date || '',
    bodyText: email.text || '',
    bodyHtml: email.html || '',
    attachments: email.attachments?.map(a => ({
      filename: a.filename || 'attachment',
      mimeType: a.mimeType || 'application/octet-stream',
      content: new Uint8Array(a.content),
      size: a.content.byteLength,
    })) || [],
    headers: email.headers?.reduce((acc: Record<string, string>, h: any) => {
      acc[h.key] = h.value;
      return acc;
    }, {}) || {},
  };
}
