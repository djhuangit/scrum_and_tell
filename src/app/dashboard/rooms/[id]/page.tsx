'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useState, useRef, useCallback } from 'react';

interface DocumentItemProps {
  id: Id<'documents'>;
  filename: string;
  fileType: string;
  createdAt: number;
  onDelete: (id: Id<'documents'>) => void;
  isDeleting: boolean;
}

const FILE_ICONS: Record<string, string> = {
  docx: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  txt: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  pptx: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605',
};

function DocumentItem({
  id,
  filename,
  fileType,
  createdAt,
  onDelete,
  isDeleting,
}: DocumentItemProps) {
  const fileIcon = FILE_ICONS[fileType] || FILE_ICONS.txt;

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
          <svg
            className="h-5 w-5 text-zinc-500 dark:text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={fileIcon} />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {filename}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(createdAt).toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(id)}
        disabled={isDeleting}
        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-red-400"
      >
        {isDeleting ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function RoomLobbyPage() {
  const params = useParams();
  const roomId = params.id as Id<'rooms'>;

  const room = useQuery(api.rooms.get, { id: roomId });
  const documents = useQuery(api.documents.listByRoom, { roomId });
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const deleteDocument = useMutation(api.documents.remove);
  const summariseDocuments = useAction(api.ai.summariseDocuments);

  const [isUploading, setIsUploading] = useState(false);
  const [isSummarising, setIsSummarising] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<Id<'documents'> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsUploading(true);
      setError(null);

      try {
        for (const file of Array.from(files)) {
          // Validate file size
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`File ${file.name} exceeds 10MB limit`);
          }

          // Process document through API
          const formData = new FormData();
          formData.append('file', file);

          const processResponse = await fetch('/api/documents/process', {
            method: 'POST',
            body: formData,
          });

          if (!processResponse.ok) {
            const data = await processResponse.json();
            throw new Error(data.error || 'Failed to process document');
          }

          const processedData = await processResponse.json();

          // Upload file to Convex storage
          const uploadUrl = await generateUploadUrl();

          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
          }

          const { storageId } = await uploadResponse.json();

          // Create document record
          await createDocument({
            roomId,
            filename: file.name,
            fileType: processedData.fileType,
            storageId,
            extractedText: processedData.extractedText,
            chunks: processedData.chunks,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [roomId, generateUploadUrl, createDocument]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDeleteDocument = async (id: Id<'documents'>) => {
    setDeletingDocId(id);
    try {
      await deleteDocument({ id });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete document'
      );
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleGenerateSummary = async () => {
    setIsSummarising(true);
    setError(null);
    try {
      await summariseDocuments({ roomId });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate summary'
      );
    } finally {
      setIsSummarising(false);
    }
  };

  // Loading state
  if (room === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
      </div>
    );
  }

  // Room not found
  if (room === null) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Room not found
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This room may have been deleted or you don&apos;t have access.
          </p>
          <Link
            href="/dashboard/rooms"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back to rooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/rooms"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to rooms
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {room.name}
            </h1>
            {room.goal && (
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {room.goal}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              room.status === 'draft'
                ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                : room.status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}
          >
            {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* Context Summary */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                Context Summary
              </h3>
              {documents && documents.length > 0 && !room.contextSummary && (
                <button
                  onClick={handleGenerateSummary}
                  disabled={isSummarising}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSummarising ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Generating...
                    </>
                  ) : (
                    'Generate Summary'
                  )}
                </button>
              )}
            </div>
            {room.contextSummary ? (
              <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {room.contextSummary}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {documents && documents.length > 0
                  ? 'Click "Generate Summary" to create context from uploaded documents.'
                  : 'Upload documents to generate context for your meeting.'}
              </p>
            )}
          </div>

          {/* Document Upload */}
          <div>
            <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-50">
              Documents ({documents?.length || 0})
            </h3>

            {/* Uploaded documents list */}
            {documents && documents.length > 0 && (
              <div className="mb-4 space-y-2">
                {documents.map((doc) => (
                  <DocumentItem
                    key={doc._id}
                    id={doc._id}
                    filename={doc.filename}
                    fileType={doc.fileType}
                    createdAt={doc.createdAt}
                    onDelete={handleDeleteDocument}
                    isDeleting={deletingDocId === doc._id}
                  />
                ))}
              </div>
            )}

            {/* Upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".docx,.pptx,.txt"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Processing documents...
                  </p>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto h-8 w-8 text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    DOCX, PPTX, TXT (max 10MB)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href={`/dashboard/rooms/${roomId}/meeting`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Start Meeting
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
