/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GmailAttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageItem {
  id: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  attachments: GmailAttachmentMeta[];
}

/**
 * Parses headers from Gmail message resource
 */
function getHeaderValue(headers: Array<{ name: string; value: string }>, name: string): string {
  const found = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : '';
}

/**
 * Recursively find all parts in a message payload that represent file attachments
 */
function extractAttachments(parts: any[]): GmailAttachmentMeta[] {
  let attachments: GmailAttachmentMeta[] = [];
  if (!parts) return attachments;

  for (const part of parts) {
    if (part.filename && part.body && part.body.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }
    if (part.parts) {
      attachments.push(...extractAttachments(part.parts));
    }
  }

  return attachments;
}

/**
 * Searches Gmail for messages matching a query.
 * Restricts by default to emails containing relevant document formats (pdfs, pngs, jpegs) or matching terms.
 */
export async function searchGmailMessages(
  accessToken: string,
  userQuery: string = ''
): Promise<GmailMessageItem[]> {
  try {
    // Construct search filters: focus on emails having attachments corresponding to construction docs/invoices
    // By default, if no userQuery is provided, we can look for attachments from the last 90 days or containing keywords.
    const defaultQuery = 'has:attachment (filename:pdf OR filename:png OR filename:jpg OR filename:jpeg)';
    const finalQuery = userQuery 
      ? `(${userQuery}) AND ${defaultQuery}` 
      : `(factura OR albaran OR recibo OR "jose real" OR obra OR uniproyect) AND ${defaultQuery}`;

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(finalQuery)}&maxResults=15`;
    const res = await fetch(listUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Error al listar mensajes de Gmail: ${res.status}`);
    }

    const listData = await res.json();
    const messages = listData.messages || [];

    // Fetch details for each message in parallel
    const detailedMessagesPromises = messages.map(async (msg: { id: string }) => {
      try {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const detailRes = await fetch(detailUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!detailRes.ok) return null;

        const data = await detailRes.json();
        const headers = data.payload?.headers || [];
        const attachments = extractAttachments(data.payload?.parts || []);

        // Only include emails that actually have attachments matching our needs
        if (attachments.length === 0) return null;

        return {
          id: data.id,
          snippet: data.snippet || '',
          from: getHeaderValue(headers, 'From'),
          subject: getHeaderValue(headers, 'Subject') || '(Sin Asunto)',
          date: getHeaderValue(headers, 'Date'),
          attachments,
        } as GmailMessageItem;
      } catch (err) {
        console.error(`Error procesando mensaje de Gmail ${msg.id}:`, err);
        return null;
      }
    });

    const results = await Promise.all(detailedMessagesPromises);
    // Filter out nulls
    return results.filter((item): item is GmailMessageItem => item !== null);
  } catch (error) {
    console.error('Error buscando correos en Gmail:', error);
    throw error;
  }
}

/**
 * Downloads a binary attachment from Gmail and translates it into a Base64 string for OCR analysis.
 */
export async function downloadGmailAttachmentAsBase64(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string> {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Error al descargar adjunto de Gmail: ${res.status}`);
    }

    const data = await res.json();
    if (!data.data) {
      throw new Error('El adjunto de Gmail no contiene datos binarios.');
    }

    // Gmail API encodes attachments in base64url format. 
    // We convert it to conventional base64 by replacing URL-safe characters.
    const base64url = data.data;
    const base64 = base64url
      .replace(/-/g, '+') // Convert '-' to '+'
      .replace(/_/g, '/'); // Convert '_' to '/'

    return base64;
  } catch (error) {
    console.error('Error al descargar archivo adjunto de Gmail:', error);
    throw error;
  }
}

/**
 * Sends a signed document as an HTML email (and with optional base64 attachment) using the Gmail API
 */
export async function sendSignedDocumentEmail(
  accessToken: string,
  toEmail: string,
  subject: string,
  bodyHtml: string,
  fileName?: string,
  fileContentBase64?: string,
  fileMimeType?: string
): Promise<void> {
  try {
    const boundary = `----=_Part_${Date.now()}`;
    const mailHeaderLines = [
      `To: ${toEmail}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(bodyHtml))),
      ``
    ];

    if (fileName && fileContentBase64) {
      mailHeaderLines.push(
        `--${boundary}`,
        `Content-Type: ${fileMimeType || 'application/octet-stream'}; name="${fileName}"`,
        `Content-Disposition: attachment; filename="${fileName}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        fileContentBase64,
        ``
      );
    }

    mailHeaderLines.push(`--${boundary}--`);

    const rawMessage = mailHeaderLines.join('\r\n');
    
    // Convert to web-safe base64url encoded string
    const base64UrlMessage = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlMessage }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Fallo al enviar correo: ${response.status}`);
    }
  } catch (err: any) {
    console.error('Error sending GMail message:', err);
    throw new Error(err.message || 'Error desconocido al enviar el email.');
  }
}
