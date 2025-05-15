"use client"

import { verifyAudioQuality, PROFESSIONAL_QUALITY } from "./audio-quality-validator"
import { generateRiffusionAudio } from "./riffusion-service"

// Riffusion API key
const RIFFUSION_API_KEY = "sk-ebfcc1a7d768b55f533eb6194e07f29b8c257373a7bdfcf634f937a0a5bba274"
const RIFFUSION_API_URL = "https://api.riffusion.com/v1"

// Track metadata interface
export interface TrackMetadata {
  id: string;
  title: string;
  genre: string;
  mood: string;
  bpm: number;
  duration: number;
  dateCreated: string;
  audioUrl: string;
  imageUrl: string;
  isRifussion: boolean;
  qualityScore: number;
  seed?: number;
}

// Library track interface with additional metadata
export interface LibraryTrack extends TrackMetadata {
  type: 'remix' | 'generated';
  original?: string;
  description?: string;
}

// Predefined genres for Rifussion
export const RIFUSSION_GENRES = [
  'electronic', 'house', 'dubstep', 'trance',
  'hiphop', 'rock', 'ambient', 'jazz',
  'pop', 'classical', 'lofi', 'cinematic'
];

// Predefined moods for Rifussion
export const RIFUSSION_MOODS = [
  'neutral', 'cheerful', 'sad', 'professional',
  'excited', 'calm', 'energetic', 'relaxed',
  'dark', 'uplifting', 'mysterious', 'epic'
];

// Note: Server-side functions have been moved to rifussion-server-actions.ts

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
