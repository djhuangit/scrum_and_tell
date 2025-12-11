import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { processDocument, getFileType } from '@/lib/document-processor';
import { handleApiError, badRequest, unauthorised } from '@/lib/api-error';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return unauthorised();
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return badRequest('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest('File size exceeds 10MB limit');
    }

    const fileType = getFileType(file.name);
    if (!fileType) {
      return badRequest(
        'Unsupported file type. Supported types: DOCX, TXT, PPTX'
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processDocument(buffer, file.name);

    return NextResponse.json({
      filename: file.name,
      fileType: result.fileType,
      textLength: result.text.length,
      chunkCount: result.chunks.length,
      extractedText: result.text,
      chunks: result.chunks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
