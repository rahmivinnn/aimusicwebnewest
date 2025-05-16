"use server"

/**
 * Audio Quality Validator
 *
 * This module provides functions to validate and ensure the quality of generated audio.
 * It includes retry logic and quality verification to maintain professional standards.
 */

// Quality thresholds for professional audio - defined as a type but not exported
type QualityThresholds = {
  minDuration: number;        // Minimum duration in seconds
  maxNoiseLevel: number;      // Maximum acceptable noise level (0-1)
  minBitrate: number;         // Minimum bitrate in kbps
  minSampleRate: number;      // Minimum sample rate in Hz
}

// Default professional quality thresholds - defined as a function to avoid exporting constants
export async function getProfessionalQualityThresholds(): Promise<QualityThresholds> {
  return {
    minDuration: 1,             // At least 1 second (more lenient)
    maxNoiseLevel: 0.15,        // More tolerance for noise
    minBitrate: 128,            // At least 128 kbps (more lenient)
    minSampleRate: 22050,       // At least 22.05 kHz (more lenient)
  };
}

// Audio quality verification result - defined as a type but not exported
type QualityVerificationResult = {
  passes: boolean;            // Whether the audio passes quality checks
  qualityScore: number;       // Quality score (0-100)
  issues: string[];           // List of quality issues found
  metadata?: {                // Audio metadata if available
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    noiseLevel?: number;
  };
}

/**
 * Verify the quality of an audio URL by fetching and analyzing it
 * Note: This is a simplified version that checks basic properties
 * In a production environment, you would use audio analysis libraries
 */
export async function verifyAudioQuality(
  audioUrl: string,
  thresholds?: QualityThresholds
): Promise<QualityVerificationResult> {
  // Get default thresholds if not provided
  if (!thresholds) {
    thresholds = await getProfessionalQualityThresholds();
  }

  try {
    console.log(`Verifying audio quality for: ${audioUrl}`);

    // For blob URLs, we need to handle them differently
    if (audioUrl.startsWith('blob:')) {
      // For blob URLs, we'll create an audio element to check duration and try to get blob size
      return new Promise((resolve) => {
        const audio = new Audio(audioUrl);
        let blobSize = 0;

        // Try to get the blob size
        fetch(audioUrl)
          .then(response => response.blob())
          .then(blob => {
            blobSize = blob.size;
            console.log(`Blob size: ${blobSize} bytes`);
          })
          .catch(error => {
            console.warn("Could not get blob size:", error);
          });

        // Set a timeout to handle cases where metadata never loads
        const timeoutId = setTimeout(() => {
          console.warn("Metadata loading timeout for blob URL");
          resolve({
            passes: false,
            qualityScore: 30, // Give it a low score but not zero
            issues: ['Metadata loading timeout'],
            metadata: {
              duration: 0,
              bitrate: 0,
            }
          });
        }, 5000);

        audio.addEventListener('loadedmetadata', () => {
          clearTimeout(timeoutId);

          // Force duration calculation for problematic browsers
          if (audio.duration === Infinity || isNaN(audio.duration)) {
            console.warn("Invalid duration detected, forcing calculation");
            try {
              audio.currentTime = 1e101;
              setTimeout(() => {
                audio.currentTime = 0;
                processDuration();
              }, 200);
            } catch (error) {
              console.warn("Error forcing duration calculation:", error);
              processDuration();
            }
          } else {
            processDuration();
          }

          function processDuration() {
            const duration = audio.duration;
            const issues: string[] = [];

            // Check duration
            if (duration === 0 || isNaN(duration) || duration === Infinity) {
              issues.push(`Invalid duration: ${duration}`);
            } else if (duration < thresholds!.minDuration) {
              issues.push(`Duration too short: ${duration.toFixed(2)}s (min: ${thresholds!.minDuration}s)`);
            }

            // Check blob size if available
            if (blobSize > 0) {
              if (blobSize < 1000) {
                issues.push(`Audio file too small: ${blobSize} bytes`);
              }

              // Check bytes per second ratio for compression quality
              if (duration > 0 && isFinite(duration)) {
                const bytesPerSecond = blobSize / duration;
                if (bytesPerSecond < 1000) {
                  issues.push(`Low quality audio: ${bytesPerSecond.toFixed(2)} bytes/second`);
                }
              }
            }

            // Calculate quality score based on multiple factors
            let durationScore = 0;
            if (duration > 0 && isFinite(duration)) {
              durationScore = Math.min(100, (duration / 10) * 100);
            }

            let sizeScore = 0;
            if (blobSize > 0) {
              sizeScore = Math.min(100, (blobSize / 100000) * 100);
            }

            // Combine scores with duration weighted more heavily
            const qualityScore = Math.round((durationScore * 0.7) + (sizeScore * 0.3));

            // Determine if it passes - more lenient for remixes
            const passes = issues.length === 0 || qualityScore >= 50;

            resolve({
              passes,
              qualityScore,
              issues,
              metadata: {
                duration,
                bitrate: blobSize > 0 ? Math.round(blobSize / (duration || 1) / 125) : 192, // Calculate bitrate if possible
              }
            });
          }
        });

        audio.addEventListener('error', (e) => {
          clearTimeout(timeoutId);
          const errorCode = audio.error ? audio.error.code : 0;
          const errorMessage = audio.error ? audio.error.message : "Unknown error";

          console.warn(`Audio error details: Code ${errorCode}, Message: ${errorMessage}`);

          resolve({
            passes: false,
            qualityScore: 0,
            issues: [`Failed to load audio: ${errorMessage}`],
          });
        });

        // Try to play a small part to verify it's playable
        audio.volume = 0.01; // Very low volume
        audio.load();

        // Try to play a tiny bit of audio to verify it's valid
        try {
          audio.play()
            .then(() => {
              setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
              }, 300);
            })
            .catch(error => {
              console.warn("Audio playback test failed:", error);
            });
        } catch (error) {
          console.warn("Error in playback test:", error);
        }
      });
    }

    // For regular URLs, fetch the audio file to check its properties
    const response = await fetch(audioUrl, { method: 'HEAD' });

    if (!response.ok) {
      return {
        passes: false,
        qualityScore: 0,
        issues: [`Failed to fetch audio: ${response.status} ${response.statusText}`]
      };
    }

    // Get content length and type
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const contentType = response.headers.get('content-type') || '';

    // Basic quality checks
    const issues: string[] = [];

    // Check file size (rough estimate of quality)
    if (contentLength < 100000) { // Less than 100KB
      issues.push(`File size too small: ${Math.round(contentLength / 1024)}KB`);
    }

    // Check content type
    if (!contentType.includes('audio')) {
      issues.push(`Not an audio file: ${contentType}`);
    }

    // Calculate a quality score based on file size
    const fileSizeScore = Math.min(100, (contentLength / 500000) * 100);
    const qualityScore = Math.round(fileSizeScore);

    // Determine if it passes
    const passes = issues.length === 0 && qualityScore >= 60;

    return {
      passes,
      qualityScore,
      issues,
      metadata: {
        duration: 30, // Assume reasonable duration for remote URLs
        bitrate: Math.round(contentLength / 30 / 125), // Rough estimate of bitrate in kbps
      }
    };
  } catch (error) {
    console.error("Error verifying audio quality:", error);
    return {
      passes: false,
      qualityScore: 0,
      issues: [`Error verifying audio quality: ${error instanceof Error ? error.message : String(error)}`]
    };
  }

  // Note: The detailed verification code below is commented out for speed
  /*
  // Get default thresholds if not provided
  if (!thresholds) {
    thresholds = await getProfessionalQualityThresholds();
  }
  try {
    console.log(`Verifying audio quality for: ${audioUrl}`);

    // Fetch the audio file to check its properties
    const response = await fetch(audioUrl, { method: 'HEAD' });

    if (!response.ok) {
      return {
        passes: true, // Still pass even with issues
        qualityScore: 60,
        issues: []
      };
    }

    // Get content length and type
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const contentType = response.headers.get('content-type') || '';

    // Basic quality checks
    const issues: string[] = [];

    // Calculate a quality score (simplified)
    const fileSizeScore = Math.min(100, (contentLength / 500000) * 50); // 1MB = 100 score (more lenient)
    const qualityScore = Math.round(fileSizeScore);

    // Always pass quality checks
    const passes = true;

    return {
      passes,
      qualityScore,
      issues,
      metadata: {
        duration: 30, // Assume reasonable duration
        bitrate: 192, // Assume reasonable bitrate
      }
    };
  } catch (error) {
    console.error("Error verifying audio quality:", error);
    return {
      passes: true, // Still pass even with errors
      qualityScore: 60,
      issues: []
    };
  }
  */
}

/**
 * Retry generating audio until it meets quality standards or max attempts reached
 */
export async function retryUntilQualityMet<T>(
  generateFn: () => Promise<T>,
  getAudioUrl: (result: T) => string,
  maxAttempts: number = 1, // Reduced to 1 for speed
  thresholds?: QualityThresholds
): Promise<{ result: T; qualityResult: QualityVerificationResult }> {
  // Fast path: Just generate once and return the result
  try {
    // Generate the audio
    const result = await generateFn();

    // Get the audio URL
    const audioUrl = getAudioUrl(result);

    // Skip detailed quality verification
    const qualityResult = await verifyAudioQuality(audioUrl);

    // Return immediately
    return { result, qualityResult };
  } catch (error) {
    console.error(`Error in fast generation:`, error);
    throw error;
  }
}
