import * as mammoth from 'mammoth';

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

export type SupportedFileType = 'docx' | 'txt' | 'pptx';

export interface ProcessedDocument {
  text: string;
  chunks: string[];
  fileType: SupportedFileType;
}

/**
 * Determines the file type from the filename extension.
 *
 * Args:
 *     filename: The name of the file including extension.
 *
 * Returns:
 *     The supported file type or null if unsupported.
 */
export function getFileType(filename: string): SupportedFileType | null {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'docx':
      return 'docx';
    case 'txt':
      return 'txt';
    case 'pptx':
      return 'pptx';
    default:
      return null;
  }
}

/**
 * Extracts text from a DOCX file buffer.
 *
 * Args:
 *     buffer: The DOCX file as a Buffer.
 *
 * Returns:
 *     The extracted text content.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extracts text from a plain text file buffer.
 *
 * Args:
 *     buffer: The text file as a Buffer.
 *
 * Returns:
 *     The text content.
 */
async function extractTxtText(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8');
}

/**
 * Extracts text from a PPTX file buffer.
 * Note: Basic implementation that extracts embedded XML text.
 *
 * Args:
 *     buffer: The PPTX file as a Buffer.
 *
 * Returns:
 *     The extracted text content.
 */
async function extractPptxText(buffer: Buffer): Promise<string> {
  // PPTX files are ZIP archives containing XML files
  // For MVP, we'll use a simple approach - in production, use a dedicated library
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const textParts: string[] = [];

  // Extract text from slide XML files
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  );

  for (const slideFile of slideFiles.sort()) {
    const content = await zip.file(slideFile)?.async('string');
    if (content) {
      // Extract text between <a:t> tags (PowerPoint text elements)
      const matches = content.match(/<a:t>([^<]*)<\/a:t>/g);
      if (matches) {
        const slideText = matches
          .map((m) => m.replace(/<\/?a:t>/g, ''))
          .join(' ');
        textParts.push(slideText);
      }
    }
  }

  return textParts.join('\n\n');
}

/**
 * Splits text into chunks with overlap for better context preservation.
 * Uses sentence-aware chunking to avoid breaking mid-sentence.
 *
 * Args:
 *     text: The text to chunk.
 *     chunkSize: Maximum size of each chunk in characters.
 *     overlap: Number of characters to overlap between chunks.
 *
 * Returns:
 *     Array of text chunks.
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (currentChunk.length + trimmedSentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // Start new chunk with overlap from previous
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + trimmedSentence;
      } else {
        // Single sentence is too long, split it
        chunks.push(trimmedSentence.slice(0, chunkSize));
        currentChunk = trimmedSentence.slice(chunkSize - overlap);
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Processes a document file and extracts text with chunking.
 *
 * Args:
 *     buffer: The file content as a Buffer.
 *     filename: The original filename for type detection.
 *
 * Returns:
 *     ProcessedDocument with extracted text and chunks.
 *
 * Raises:
 *     Error: If the file type is not supported.
 */
export async function processDocument(
  buffer: Buffer,
  filename: string
): Promise<ProcessedDocument> {
  const fileType = getFileType(filename);

  if (!fileType) {
    throw new Error(
      `Unsupported file type: ${filename}. Supported types: DOCX, TXT, PPTX`
    );
  }

  let text: string;

  switch (fileType) {
    case 'docx':
      text = await extractDocxText(buffer);
      break;
    case 'txt':
      text = await extractTxtText(buffer);
      break;
    case 'pptx':
      text = await extractPptxText(buffer);
      break;
  }

  // Clean up the extracted text
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const chunks = chunkText(text);

  return {
    text,
    chunks,
    fileType,
  };
}
