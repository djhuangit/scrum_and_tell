# Document Processing Research

> PDF, DOCX, and PPTX extraction for voice meeting agents

## 1. Overview

Document processing enables the meeting agent to understand attached context documents. Key requirements:
- Extract text from PDF, DOCX, PPTX formats
- Handle tables, lists, and structured content
- Chunk documents for LLM context windows
- Support server-side processing in Next.js

## 2. PDF Extraction

### pdf-parse (Recommended for Simple PDFs)

```typescript
import pdf from 'pdf-parse';

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

// With metadata
async function extractPdfWithMetadata(buffer: Buffer) {
  const data = await pdf(buffer);
  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info,
    metadata: data.metadata
  };
}
```

### pdf.js for Complex PDFs

```typescript
import * as pdfjsLib from 'pdfjs-dist';

async function extractPdfWithLayout(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');

    pages.push(pageText);
  }

  return pages.join('\n\n');
}
```

### Unstructured.io API (Best Quality)

```typescript
const UNSTRUCTURED_API_KEY = process.env.UNSTRUCTURED_API_KEY;

async function extractWithUnstructured(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('files', file);

  const response = await fetch('https://api.unstructured.io/general/v0/general', {
    method: 'POST',
    headers: {
      'unstructured-api-key': UNSTRUCTURED_API_KEY!
    },
    body: formData
  });

  const elements = await response.json();

  return elements
    .map((el: any) => el.text)
    .join('\n\n');
}
```

## 3. DOCX Extraction

### mammoth (Recommended)

```typescript
import mammoth from 'mammoth';

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// With HTML conversion for structure preservation
async function extractDocxWithStructure(buffer: Buffer) {
  const result = await mammoth.convertToHtml({ buffer });
  return {
    html: result.value,
    messages: result.messages
  };
}

// Custom style mapping
async function extractDocxStyled(buffer: Buffer) {
  const result = await mammoth.convertToHtml({
    buffer,
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Quote'] => blockquote:fresh"
    ]
  });
  return result.value;
}
```

### docx Library for Advanced Parsing

```typescript
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as JSZip from 'jszip';

async function parseDocxStructure(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const content = await zip.file('word/document.xml')?.async('string');

  // Parse XML content for detailed structure
  // Returns paragraphs, tables, lists separately
  return parseXmlContent(content);
}
```

## 4. PPTX Extraction

### pptx-parser

```typescript
import PptxParser from 'pptx-parser';

async function extractPptxText(buffer: Buffer): Promise<string> {
  const parser = new PptxParser();
  const slides = await parser.parse(buffer);

  return slides
    .map((slide, i) => `Slide ${i + 1}:\n${slide.text}`)
    .join('\n\n');
}
```

### JSZip Manual Extraction

```typescript
import * as JSZip from 'jszip';
import { parseString } from 'xml2js';

async function extractPptxSlides(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides: string[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
    .sort();

  for (const slideFile of slideFiles) {
    const content = await zip.file(slideFile)?.async('string');
    if (content) {
      const text = await extractTextFromSlideXml(content);
      slides.push(text);
    }
  }

  return slides;
}

async function extractTextFromSlideXml(xml: string): Promise<string> {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) reject(err);

      const texts: string[] = [];
      extractTexts(result, texts);
      resolve(texts.join(' '));
    });
  });
}

function extractTexts(obj: any, texts: string[]) {
  if (typeof obj === 'string') {
    texts.push(obj);
  } else if (Array.isArray(obj)) {
    obj.forEach(item => extractTexts(item, texts));
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj['a:t']) {
      texts.push(obj['a:t'].join(' '));
    }
    Object.values(obj).forEach(value => extractTexts(value, texts));
  }
}
```

## 5. Unified Document Processor

```typescript
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

interface ProcessedDocument {
  text: string;
  metadata: {
    type: string;
    pages?: number;
    title?: string;
  };
  chunks: string[];
}

export async function processDocument(
  buffer: Buffer,
  filename: string
): Promise<ProcessedDocument> {
  const extension = filename.split('.').pop()?.toLowerCase();

  let text: string;
  let metadata: ProcessedDocument['metadata'];

  switch (extension) {
    case 'pdf':
      const pdfData = await pdf(buffer);
      text = pdfData.text;
      metadata = {
        type: 'pdf',
        pages: pdfData.numpages,
        title: pdfData.info?.Title
      };
      break;

    case 'docx':
      const docxResult = await mammoth.extractRawText({ buffer });
      text = docxResult.value;
      metadata = { type: 'docx' };
      break;

    case 'pptx':
      text = await extractPptxText(buffer);
      metadata = { type: 'pptx' };
      break;

    case 'txt':
    case 'md':
      text = buffer.toString('utf-8');
      metadata = { type: extension };
      break;

    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }

  const chunks = chunkText(text);

  return { text, metadata, chunks };
}
```

## 6. Text Chunking Strategies

### Fixed Size Chunking

```typescript
function chunkBySize(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}
```

### Sentence-Aware Chunking

```typescript
function chunkBySentence(text: string, maxChunkSize: number = 1000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

### Semantic Chunking with Headers

```typescript
function chunkByHeaders(text: string): string[] {
  // Split on markdown-style headers
  const sections = text.split(/(?=^#{1,3}\s)/m);

  return sections
    .map(section => section.trim())
    .filter(section => section.length > 0);
}
```

### Token-Aware Chunking

```typescript
import { encoding_for_model } from 'tiktoken';

function chunkByTokens(
  text: string,
  maxTokens: number = 500,
  model: string = 'gpt-4o'
): string[] {
  const encoder = encoding_for_model(model as any);
  const tokens = encoder.encode(text);
  const chunks: string[] = [];

  for (let i = 0; i < tokens.length; i += maxTokens) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    chunks.push(encoder.decode(chunkTokens));
  }

  encoder.free();
  return chunks;
}
```

## 7. Document Storage in Convex

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  documents: defineTable({
    roomId: v.id('rooms'),
    filename: v.string(),
    fileType: v.string(),
    storageId: v.id('_storage'),
    extractedText: v.string(),
    chunks: v.array(v.string()),
    metadata: v.object({
      pages: v.optional(v.number()),
      title: v.optional(v.string())
    }),
    createdAt: v.number()
  }).index('by_room', ['roomId'])
});

// convex/documents.ts
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const upload = mutation({
  args: {
    roomId: v.id('rooms'),
    filename: v.string(),
    fileType: v.string(),
    storageId: v.id('_storage'),
    extractedText: v.string(),
    chunks: v.array(v.string()),
    metadata: v.object({
      pages: v.optional(v.number()),
      title: v.optional(v.string())
    })
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db.insert('documents', {
      ...args,
      createdAt: Date.now()
    });
  }
});

export const getByRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('documents')
      .withIndex('by_room', q => q.eq('roomId', args.roomId))
      .collect();
  }
});
```

## 8. Next.js API Route

```typescript
// app/api/documents/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { processDocument } from '@/lib/document-processor';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const processed = await processDocument(buffer, file.name);

    return NextResponse.json({
      text: processed.text,
      chunks: processed.chunks,
      metadata: processed.metadata
    });
  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
```

## 9. Client Upload Component

```typescript
'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function DocumentUpload({ roomId }: { roomId: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocument = useMutation(api.documents.save);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      // 1. Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();
      setProgress(20);

      // 2. Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
      });
      const { storageId } = await result.json();
      setProgress(50);

      // 3. Process document
      const formData = new FormData();
      formData.append('file', file);

      const processResponse = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData
      });
      const processed = await processResponse.json();
      setProgress(80);

      // 4. Save to Convex
      await saveDocument({
        roomId,
        filename: file.name,
        fileType: file.type,
        storageId,
        extractedText: processed.text,
        chunks: processed.chunks,
        metadata: processed.metadata
      });
      setProgress(100);

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="document-upload">
      <input
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        disabled={uploading}
      />
      {uploading && (
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
```

## 10. LLM Context Preparation

```typescript
function prepareDocumentContext(
  documents: Array<{ filename: string; chunks: string[] }>,
  maxTokens: number = 4000
): string {
  const encoder = encoding_for_model('gpt-4o');
  let context = '';
  let tokenCount = 0;

  for (const doc of documents) {
    const header = `\n--- Document: ${doc.filename} ---\n`;
    const headerTokens = encoder.encode(header).length;

    if (tokenCount + headerTokens > maxTokens) break;

    context += header;
    tokenCount += headerTokens;

    for (const chunk of doc.chunks) {
      const chunkTokens = encoder.encode(chunk).length;

      if (tokenCount + chunkTokens > maxTokens) break;

      context += chunk + '\n';
      tokenCount += chunkTokens;
    }
  }

  encoder.free();
  return context;
}
```

## 11. Best Practices

1. **File Size Limits**: Set reasonable limits (10-20MB) to prevent timeouts
2. **Async Processing**: Use background jobs for large documents
3. **Error Handling**: Gracefully handle corrupted or unsupported files
4. **Caching**: Cache extracted text to avoid reprocessing
5. **Chunking Strategy**: Match chunk size to your LLM's context window
6. **Metadata Preservation**: Keep document structure for reference
7. **Security**: Validate file types and scan for malware

## 12. Sources

- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse)
- [mammoth.js Documentation](https://www.npmjs.com/package/mammoth)
- [Unstructured.io API](https://unstructured.io/api-reference)
- [Convex File Storage](https://docs.convex.dev/file-storage)
