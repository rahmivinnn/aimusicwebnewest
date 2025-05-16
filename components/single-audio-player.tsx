"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface SingleAudioPlayerProps {
  src: string;
  fallbackSrc?: string;
  onError?: (error: Error) => void;
  showDownload?: boolean;
  downloadFilename?: string;
  className?: string;
}

export function SingleAudioPlayer({
  src,
  fallbackSrc,
  onError,
  showDownload = true,
  downloadFilename = "audio.mp3",
  className = "",
}: SingleAudioPlayerProps) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [audioSrc, setAudioSrc] = useState(src);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);

  // Format time in MM:SS format
  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    } else {
      // Create a user interaction context for autoplay
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Start animation frame for progress updates
            animationRef.current = requestAnimationFrame(updateProgress);
          })
          .catch((error) => {
            console.error("Playback failed:", error);
            toast({
              title: "Playback failed",
              description: "There was an issue playing this audio. Please try again.",
              variant: "destructive",
            });
          });
      }
    }
    
    setIsPlaying(!isPlaying);
  };

  // Update progress continuously during playback
  const updateProgress = () => {
    if (!audioRef.current) return;
    
    setCurrentTime(audioRef.current.currentTime);
    
    // Continue animation loop
    animationRef.current = requestAnimationFrame(updateProgress);
  };

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  // Handle mute toggle
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Handle seeking
  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  // Handle download
  const handleDownload = () => {
    try {
      // If we have a blob URL, use it directly
      if (blobUrl) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Otherwise, fetch the source and create a download link
      fetch(audioSrc)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = downloadFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast({
            title: "Download started",
            description: "Your audio file is being downloaded.",
          });
        })
        .catch(error => {
          console.error("Download error:", error);
          toast({
            title: "Download failed",
            description: "There was an error downloading the audio file.",
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download error",
        description: "There was an error preparing the download.",
        variant: "destructive",
      });
    }
  };

  // Load audio from URL and handle different URL types
  const loadAudioFromUrl = async (url: string) => {
    setIsLoading(true);
    setHasError(false);
    
    try {
      // For blob URLs, we can use them directly
      if (url.startsWith("blob:")) {
        setBlobUrl(url);
        return url;
      }
      
      // For data URLs, we can also use them directly
      if (url.startsWith("data:")) {
        return url;
      }
      
      // For remote URLs, fetch them to ensure they're valid and create a blob URL
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      // If HEAD request succeeded, we can use the original URL
      return url;
    } catch (error) {
      console.error("Error loading audio:", error);
      setHasError(true);
      if (onError) onError(error instanceof Error ? error : new Error(String(error)));
      
      // Try fallback if available
      if (fallbackSrc) {
        toast({
          title: "Using fallback audio",
          description: "The original audio couldn't be loaded. Using fallback audio instead.",
          variant: "warning",
        });
        return loadAudioFromUrl(fallbackSrc);
      }
      
      return url; // Return original URL as last resort
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize audio element and load audio
  useEffect(() => {
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      // Set up event listeners
      audioRef.current.addEventListener("play", () => setIsPlaying(true));
      audioRef.current.addEventListener("pause", () => {
        setIsPlaying(false);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      });
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      });
      audioRef.current.addEventListener("loadedmetadata", () => {
        if (audioRef.current && isFinite(audioRef.current.duration)) {
          setDuration(audioRef.current.duration);
          setIsLoading(false);
        }
      });
      audioRef.current.addEventListener("error", (e) => {
        const error = audioRef.current?.error;
        console.error("Audio error:", error);
        setHasError(true);
        setIsLoading(false);
        
        // Try fallback if available
        if (fallbackSrc && audioRef.current?.src !== fallbackSrc) {
          toast({
            title: "Audio error",
            description: "There was an error loading the audio. Using fallback audio.",
            variant: "warning",
          });
          audioRef.current.src = fallbackSrc;
          audioRef.current.load();
        } else if (onError && error) {
          onError(new Error(`Audio error: ${error.message || error.code}`));
        }
      });
      
      // Set initial volume
      audioRef.current.volume = volume / 100;
    }
    
    // Load audio from URL
    loadAudioFromUrl(src).then(processedUrl => {
      if (audioRef.current) {
        audioRef.current.src = processedUrl;
        audioRef.current.load();
      }
      setAudioSrc(processedUrl);
    });
    
    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }
      
      // Revoke any blob URLs we created
      if (blobUrl && blobUrl.startsWith("blob:") && blobUrl !== src) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlayPause}
          disabled={isLoading || hasError}
          className="h-8 w-8"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={isLoading || hasError || duration === 0}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          
          {showDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="h-8 w-8"
              disabled={isLoading || hasError}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={[volume]}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          className="flex-1"
        />
      </div>
    </div>
  );
}
