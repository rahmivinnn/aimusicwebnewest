"use server"

import {
  LibraryTrack,
  RIFUSSION_GENRES,
  RIFUSSION_MOODS
} from "@/lib/rifussion-library-service";
import {
  generateRifussionLibrary,
  getRifussionTrack
} from "@/lib/rifussion-server-actions";
import { verifyAudioQuality, PROFESSIONAL_QUALITY } from "@/lib/audio-quality-validator";

// In-memory cache for library tracks
// In a real application, this would be stored in a database
let libraryCache: LibraryTrack[] = [];
let remixHistoryCache: LibraryTrack[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Get library tracks with optional filtering
 */
export async function getLibraryTracks({
  filter = 'all',
  genre = '',
  mood = '',
  search = '',
  limit = 20
}: {
  filter?: string;
  genre?: string;
  mood?: string;
  search?: string;
  limit?: number;
}): Promise<{ tracks: LibraryTrack[]; total: number }> {
  try {
    // Check if we need to refresh the cache
    if (libraryCache.length === 0 || Date.now() - lastCacheUpdate > CACHE_TTL) {
      await refreshLibraryCache();
    }

    // Apply filters
    let filteredTracks = [...libraryCache];

    // Filter by type
    if (filter === 'remixes') {
      filteredTracks = filteredTracks.filter(track => track.type === 'remix');
    } else if (filter === 'generated') {
      filteredTracks = filteredTracks.filter(track => track.type === 'generated');
    }

    // Filter by genre
    if (genre && genre !== 'all') {
      filteredTracks = filteredTracks.filter(track => track.genre.toLowerCase() === genre.toLowerCase());
    }

    // Filter by mood
    if (mood && mood !== 'all') {
      filteredTracks = filteredTracks.filter(track => track.mood.toLowerCase() === mood.toLowerCase());
    }

    // Search by title or description
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTracks = filteredTracks.filter(track =>
        track.title.toLowerCase().includes(searchLower) ||
        (track.description && track.description.toLowerCase().includes(searchLower))
      );
    }

    // Return limited results
    return {
      tracks: filteredTracks.slice(0, limit),
      total: filteredTracks.length
    };
  } catch (error) {
    console.error("Error getting library tracks:", error);
    return { tracks: [], total: 0 };
  }
}

/**
 * Get remix history tracks with optional filtering
 */
export async function getRemixHistoryTracks({
  filter = 'all',
  search = '',
  limit = 20
}: {
  filter?: string;
  search?: string;
  limit?: number;
}): Promise<{ tracks: LibraryTrack[]; total: number }> {
  try {
    // Check if we need to refresh the cache
    if (remixHistoryCache.length === 0 || Date.now() - lastCacheUpdate > CACHE_TTL) {
      await refreshLibraryCache();
    }

    // Apply filters
    let filteredTracks = [...remixHistoryCache];

    // Filter by recency
    if (filter === 'recent') {
      filteredTracks.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
    } else if (filter === 'oldest') {
      filteredTracks.sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
    } else if (filter === 'a-z') {
      filteredTracks.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Search by title or description
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTracks = filteredTracks.filter(track =>
        track.title.toLowerCase().includes(searchLower) ||
        (track.description && track.description.toLowerCase().includes(searchLower))
      );
    }

    // Return limited results
    return {
      tracks: filteredTracks.slice(0, limit),
      total: filteredTracks.length
    };
  } catch (error) {
    console.error("Error getting remix history tracks:", error);
    return { tracks: [], total: 0 };
  }
}

/**
 * Get a single track by ID
 */
export async function getTrackById(trackId: string): Promise<LibraryTrack | null> {
  try {
    // Check cache first
    const cachedTrack = [...libraryCache, ...remixHistoryCache].find(track => track.id === trackId);
    if (cachedTrack) {
      return cachedTrack;
    }

    // If not in cache, try to fetch it
    return await getRifussionTrack(trackId);
  } catch (error) {
    console.error(`Error getting track ${trackId}:`, error);
    return null;
  }
}

/**
 * Refresh the library cache with new tracks
 */
async function refreshLibraryCache(): Promise<void> {
  try {
    console.log("Refreshing Rifussion library cache...");

    // Generate library tracks
    const libraryTracks = await generateRifussionLibrary(16);
    libraryCache = libraryTracks;

    // Generate remix history tracks (subset with different metadata)
    remixHistoryCache = libraryTracks
      .slice(0, 8)
      .map(track => ({
        ...track,
        type: 'remix',
        title: `${track.title} (Remix)`,
        dateCreated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last 30 days
      }));

    lastCacheUpdate = Date.now();
    console.log(`Library cache refreshed with ${libraryCache.length} tracks and ${remixHistoryCache.length} remix history tracks`);
  } catch (error) {
    console.error("Error refreshing library cache:", error);
    throw error;
  }
}

/**
 * Verify track quality and return a professional-grade track
 */
export async function verifyTrackQuality(trackId: string): Promise<{
  isQualityVerified: boolean;
  qualityScore: number;
  track: LibraryTrack | null;
  issues?: string[];
}> {
  try {
    const track = await getTrackById(trackId);
    if (!track) {
      console.warn(`Track not found: ${trackId}`);
      return {
        isQualityVerified: false,
        qualityScore: 0,
        track: null,
        issues: ["Track not found"]
      };
    }

    try {
      // Verify audio quality
      const qualityResult = await verifyAudioQuality(track.audioUrl, PROFESSIONAL_QUALITY);

      return {
        isQualityVerified: qualityResult.passes,
        qualityScore: qualityResult.qualityScore,
        track,
        issues: qualityResult.issues
      };
    } catch (qualityError) {
      console.error(`Error verifying audio quality for ${trackId}:`, qualityError);

      // Return the track anyway, but mark it as not quality verified
      return {
        isQualityVerified: false,
        qualityScore: Math.max(track.qualityScore || 0, 60), // Use track's score or default to 60
        track,
        issues: [qualityError instanceof Error ? qualityError.message : String(qualityError)]
      };
    }
  } catch (error) {
    console.error(`Error verifying track quality for ${trackId}:`, error);

    // Try to get a fallback track instead of returning null
    try {
      const fallbackTrack = await getRifussionTrack(trackId);

      return {
        isQualityVerified: false,
        qualityScore: fallbackTrack ? 70 : 0,
        track: fallbackTrack,
        issues: ["Using fallback track due to error"]
      };
    } catch (fallbackError) {
      console.error(`Error getting fallback track for ${trackId}:`, fallbackError);
      return {
        isQualityVerified: false,
        qualityScore: 0,
        track: null,
        issues: ["Failed to get track or fallback"]
      };
    }
  }
}
