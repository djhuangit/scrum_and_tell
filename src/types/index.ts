export type RoomStatus = 'draft' | 'active' | 'completed';

export type MeetingStatus = 'lobby' | 'active' | 'paused' | 'ended';

export type ActionItemStatus = 'pending' | 'completed';

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  imageUrl?: string;
  createdAt: number;
}

export interface Room {
  _id: string;
  name: string;
  goal?: string;
  creatorId: string;
  status: RoomStatus;
  contextSummary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Document {
  _id: string;
  roomId: string;
  filename: string;
  fileType: string;
  storageId: string;
  extractedText: string;
  chunks: string[];
  createdAt: number;
}

export interface Meeting {
  _id: string;
  roomId: string;
  status: MeetingStatus;
  startedAt?: number;
  endedAt?: number;
}

export interface Transcript {
  _id: string;
  meetingId: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface SpeakerUpdate {
  _id: string;
  meetingId: string;
  speakerId: string;
  speakerName: string;
  summary: string;
  risks: string[];
  gaps: string[];
  proposedActions: string[];
  createdAt: number;
}

export interface ActionItem {
  _id: string;
  meetingId: string;
  roomId: string;
  task: string;
  owner: string;
  status: ActionItemStatus;
  createdAt: number;
}

export interface MeetingSummary {
  _id: string;
  meetingId: string;
  roomId: string;
  overview: string;
  decisions: string[];
  risks: string[];
  nextSteps: string[];
  generatedAt: number;
}
