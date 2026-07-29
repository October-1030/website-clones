import { assertPdfSignature, assertPlainText, StudyFileError } from "./file-validation";
import { MAX_EXTRACTED_CHARS, MAX_PDF_PAGES, type StudyFileKind, type StudySourcePage } from "./types";

export interface ExtractedStudyDocument {
  pages: StudySourcePage[];
  pageCount: number;
  truncated: boolean;
}

function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function capPages(pages: StudySourcePage[]): { pages: StudySourcePage[]; truncated: boolean } {
  let remaining = MAX_EXTRACTED_CHARS;
  let truncated = false;
  const capped: StudySourcePage[] = [];
  for (const page of pages) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const text = page.text.slice(0, remaining);
    if (text.length < page.text.length) truncated = true;
    if (text.trim()) capped.push({ ...page, text });
    remaining -= text.length;
  }
  return { pages: capped, truncated };
}

export async function extractStudyDocument(bytes: Uint8Array, kind: StudyFileKind): Promise<ExtractedStudyDocument> {
  let pages: StudySourcePage[];
  let pageCount = 1;
  if (kind === "txt") {
    const text = cleanText(assertPlainText(bytes));
    pages = [{ page: null, label: "TXT 片段", text }];
  } else {
    assertPdfSignature(bytes);
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      if (pdf.numPages > MAX_PDF_PAGES) {
        throw new StudyFileError(`PDF files are limited to ${MAX_PDF_PAGES} pages.`, "pdf_too_many_pages", 413);
      }
      const extracted = await extractText(pdf);
      pageCount = extracted.totalPages;
      pages = extracted.text.map((text, index) => ({ page: index + 1, label: `第 ${index + 1} 页`, text: cleanText(text) }));
    } catch (error) {
      if (error instanceof StudyFileError) throw error;
      throw new StudyFileError("PDF 解析失败。文件可能已损坏、加密或不包含可提取文字。", "pdf_parse_failed", 422);
    }
  }

  const capped = capPages(pages);
  if (!capped.pages.some((page) => page.text.trim().length > 0)) {
    throw new StudyFileError("没有提取到可总结的文字。扫描版 PDF 暂不支持 OCR。", "empty_document", 422);
  }
  return { pages: capped.pages, pageCount, truncated: capped.truncated };
}
