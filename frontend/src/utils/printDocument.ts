import { Message } from '@arco-design/web-react';

export interface PrintDocumentOptions {
  title?: string;
  docNumber?: string;
  styles?: string;
}

/**
 * Universally and reliably prints official documents (OS-1, OS-2, OS-4, etc.)
 * in a dedicated, isolated popup window.
 * This completely avoids issues where modal containers, fixed headers,
 * overflow styles, or dashboard buttons bleed into the print output.
 */
export function printDocument(contentHtml: string, options: PrintDocumentOptions = {}): boolean {
  if (!contentHtml || !contentHtml.trim()) {
    Message.warning('Chop etish uchun hujjat maʼlumoti mavjud emas');
    return false;
  }

  const title =
    options.title ||
    (options.docNumber ? `Dalolatnoma — ${options.docNumber}` : 'Rasmiy Davlat Hujjati');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    Message.error('Brauzer oynasi bloklandi. Iltimos, qalqib chiquvchi oynalarga ruxsat bering.');
    return false;
  }

  const baseStyles = `
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Times New Roman', Times, 'Liberation Serif', Georgia, serif;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-size: 13px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header { text-align: center; margin-bottom: 16px; }
    .header .ministry { font-size: 11.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #111; }
    .header .org { font-size: 13.5px; font-weight: bold; text-transform: uppercase; margin-top: 4px; color: #1e3a8a; }
    .divider { border-bottom: 2px solid #000000; margin: 10px auto; width: 96%; }
    .doc-title { text-align: center; margin: 14px 0 16px; }
    .doc-title h2, .doc-title h3 { margin: 0; font-size: 15px; font-weight: bold; text-transform: uppercase; color: #000; }
    .doc-title .meta { margin-top: 6px; font-weight: bold; font-size: 12px; color: #333333; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 12.5px;
      background-color: #fafbfc;
      border: 1px solid #d9d9d9;
      padding: 10px 14px;
    }
    .info-grid p { margin: 3px 0; }
    .parties { margin: 12px 0; font-size: 13px; background-color: #fafbfc; border: 1px solid #e0e0e0; padding: 10px 14px; }
    .parties p { margin: 3px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 11.5px;
      border: 1.5px solid #000000;
      background-color: #ffffff;
    }
    th, td {
      border: 1px solid #000000;
      padding: 6px 8px;
    }
    th {
      background-color: #f0f2f5 !important;
      font-weight: bold;
      text-align: center;
      color: #000000;
    }
    .signatures-title {
      margin-top: 24px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 5px;
      color: #000000;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 14px;
    }
    .sig-card {
      border: 1px solid #b8bcc4;
      padding: 10px 14px;
      border-radius: 4px;
      background-color: #fdfdfd;
    }
    .sig-role { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #1d2129; }
    .sig-name { margin-top: 4px; font-size: 13px; font-weight: 600; color: #111; }
    .sig-status {
      margin-top: 6px;
      padding: 3px 8px;
      font-size: 10.5px;
      font-weight: bold;
      border-radius: 3px;
      display: inline-block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .sig-status.signed { background-color: #E8FFEA !important; color: #00B42A !important; border: 1px solid #B7EB8F !important; }
    .sig-status.pending { background-color: #FFF7E8 !important; color: #FF7D00 !important; border: 1px solid #FFE7BA !important; }
    .signatures { margin-top: 32px; display: flex; justify-content: space-between; }
    .sig-box { width: 30%; }
    .stamp-badge {
      margin-top: 24px;
      padding: 12px 16px;
      border: 2px dashed #4E5969;
      background-color: #fafbfc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 4px;
    }
    ${options.styles || ''}
  `;

  let docHtml = '';
  if (contentHtml.includes('<!DOCTYPE html>') || contentHtml.includes('<html')) {
    if (contentHtml.includes('</head>')) {
      docHtml = contentHtml.replace('</head>', `<style>${baseStyles}</style></head>`);
    } else {
      docHtml = contentHtml.replace('<body', `<head><style>${baseStyles}</style></head><body`);
    }
  } else {
    docHtml = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="os-document-sheet" style="border:none!important;box-shadow:none!important;padding:0!important;max-width:100%!important;">
    ${contentHtml}
  </div>
</body>
</html>`;
  }

  printWindow.document.open();
  printWindow.document.write(docHtml);
  printWindow.document.close();

  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // ignore
    }
  }, 400);

  return true;
}

/**
 * Extracts and prints the innerHTML of a specific DOM element (e.g. #official-doc-print-area)
 */
export function printElement(
  elementOrSelector: HTMLElement | string,
  options: PrintDocumentOptions = {},
): boolean {
  let element: HTMLElement | null = null;
  if (typeof elementOrSelector === 'string') {
    element = document.querySelector(elementOrSelector);
  } else {
    element = elementOrSelector;
  }

  if (!element) {
    Message.error('Chop etiladigan hujjat sohasi topilmadi');
    return false;
  }

  return printDocument(element.innerHTML, options);
}
