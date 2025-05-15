"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Share2, Trash2, Search, Play, Pause, Loader2, Music, BadgeCheck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { getRemixHistoryTracks, verifyTrackQuality } from "@/app/actions/library-actions"
import { LibraryTrack, RIFUSSION_GENRES } from "@/lib/rifussion-library-service"

// Client-side formatDuration function to avoid using server action
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function RemixHistoryPage() {
  const [filter, setFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [remixes, setRemixes] = useState<LibraryTrack[]>([])
  const [popularRemixes, setPopularRemixes] = useState<LibraryTrack[]>([])
  const [selectedGenre, setSelectedGenre] = useState("all")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()

  // Fetch remixes on component mount and when filter or genre changes
  useEffect(() => {
    async function fetchRemixes() {
      setIsLoading(true)
      try {
        const result = await getRemixHistoryTracks({
          filter,
          search: searchQuery,
          limit: 20 // Increased limit to ensure we have enough tracks after filtering
        });

        // Apply genre filter client-side if needed
        let filteredTracks = result.tracks;
        if (selectedGenre !== "all") {
          filteredTracks = filteredTracks.filter(track =>
            track.genre.toLowerCase() === selectedGenre.toLowerCase()
          );
        }

        setRemixes(filteredTracks);

        // For popular remixes, we'll just use the same tracks but sorted differently
        // Sort by quality score to ensure professional quality tracks are shown first
        const popular = [...filteredTracks].sort((a, b) => b.qualityScore - a.qualityScore);
        setPopularRemixes(popular);

      } catch (error) {
        console.error("Error fetching remixes:", error);
        toast({
          title: "Error",
          description: "Failed to load remix history. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchRemixes();
  }, [filter, searchQuery, selectedGenre, toast]);

  // Play or pause a track with quality verification
  const handlePlayPause = async (trackId: string) => {
    if (currentlyPlaying === trackId) {
      // If this track is already playing, pause it
      audioRef.current?.pause()
      setCurrentlyPlaying(null)
    } else {
      // If another track is playing, stop it first
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      // Verify track quality before playing
      try {
        const track = remixes.find(t => t.id === trackId) ||
                     popularRemixes.find(t => t.id === trackId);

        if (!track) {
          throw new Error("Track not found");
        }

        // Verify the track quality
        const qualityResult = await verifyTrackQuality(trackId);

        if (!qualityResult.isQualityVerified && qualityResult.qualityScore < 70) {
          toast({
            title: "Quality Warning",
            description: "This track doesn't meet our professional quality standards. Playing anyway.",
            variant: "warning",
          });
        }

        // Show loading toast first
        const loadingToastId = toast({
          title: "Loading Audio",
          description: "Preparing professional-quality audio...",
        }).id;

        // Create a new audio element and set up event handlers
        const audio = new Audio();

        // Set up event handlers before setting the src
        audio.volume = 0.8; // Set default volume

        audio.onended = () => {
          setCurrentlyPlaying(null);
        };

        audio.onerror = (e) => {
          console.error("Audio error:", e);
          toast({
            title: "Error",
            description: "Failed to play audio. Using fallback audio.",
            variant: "destructive",
          });

          // Try to play a fallback sample based on genre
          const fallbackSample = `/samples/music-${track.mood || 'neutral'}.mp3`;
          audio.src = fallbackSample;
          audio.play().catch(err => {
            console.error("Fallback audio error:", err);
            setCurrentlyPlaying(null);
          });
        };

        // Set up canplaythrough event to dismiss loading toast
        audio.oncanplaythrough = () => {
          toast({
            id: loadingToastId,
            title: "Now Playing",
            description: `${track.title} - Professional quality audio`,
          });
        };

        // Set the source and load the audio
        audio.src = track.audioUrl;

        // Try to play the audio with error handling
        try {
          await audio.play();

          // Update toast on successful play
          toast({
            title: "Now Playing",
            description: `${track.title} - Professional quality audio`,
          });

          audioRef.current = audio;
          setCurrentlyPlaying(trackId);
        } catch (playError) {
          console.error("Error playing audio:", playError);
          toast({
            title: "Playback Error",
            description: "Failed to play audio. Using fallback audio.",
            variant: "destructive",
          });

          // Try to play a fallback sample based on genre
          try {
            const fallbackSample = `/samples/music-${track.mood || 'neutral'}.mp3`;
            audio.src = fallbackSample;
            await audio.play();
            audioRef.current = audio;
            setCurrentlyPlaying(trackId);
          } catch (fallbackError) {
            console.error("Fallback audio error:", fallbackError);
            setCurrentlyPlaying(null);
          }
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        toast({
          title: "Error",
          description: "Failed to play audio. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Download a track with quality verification
  const handleDownload = async (trackId: string) => {
    try {
      const track = remixes.find(t => t.id === trackId) ||
                   popularRemixes.find(t => t.id === trackId);

      if (!track) {
        throw new Error("Track not found");
      }

      // Verify track quality before downloading
      const qualityResult = await verifyTrackQuality(trackId);

      if (!qualityResult.isQualityVerified && qualityResult.qualityScore < 70) {
        // Ask for confirmation if quality is low
        if (!confirm("This track doesn't meet our professional quality standards. Download anyway?")) {
          return;
        }
      }

      // Show loading toast
      toast({
        title: "Preparing Download",
        description: "Preparing professional-quality audio file...",
      });

      // Download the file
      const response = await fetch(track.audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${track.title.replace(/\s+/g, '-')}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: "Professional-quality audio downloaded successfully!",
      });
    } catch (error) {
      console.error("Error downloading audio:", error);
      toast({
        title: "Error",
        description: "Failed to download audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Share a track
  const handleShare = (trackId: string) => {
    const track = remixes.find(t => t.id === trackId) ||
                 popularRemixes.find(t => t.id === trackId);

    if (!track) {
      toast({
        title: "Error",
        description: "Track not found",
        variant: "destructive",
      });
      return;
    }

    const title = track.title;
    const url = `${window.location.href}?track=${trackId}`;
    const text = `Check out this professional-quality ${track.genre} track: ${title}`;

    if (navigator.share) {
      navigator
        .share({
          title,
          text,
          url,
        })
        .then(() => {
          toast({
            title: "Shared",
            description: "Track shared successfully!",
          });
        })
        .catch((error) => {
          console.error("Error sharing:", error);
          handleFallbackShare(url);
        });
    } else {
      handleFallbackShare(url);
    }
  };

  const handleFallbackShare = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({
          title: "Link Copied",
          description: "Link copied to clipboard!",
        })
      })
      .catch((error) => {
        console.error("Error copying to clipboard:", error)
        toast({
          title: "Error",
          description: "Failed to copy link. Please try again.",
          variant: "destructive",
        })
      })
  }

  const handleDelete = (trackId: string) => {
    // In a real app, you would delete from your database
    const track = remixes.find(t => t.id === trackId) ||
                 popularRemixes.find(t => t.id === trackId);

    if (!track) {
      toast({
        title: "Error",
        description: "Track not found",
        variant: "destructive",
      });
      return;
    }

    // Remove from local state (in a real app, you would call an API)
    setRemixes(remixes.filter(t => t.id !== trackId));
    setPopularRemixes(popularRemixes.filter(t => t.id !== trackId));

    toast({
      title: "Deleted",
      description: `"${track.title}" removed from your library`,
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rifussion Remix History</h1>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="search"
              placeholder="Search remixes"
              className="w-[250px] bg-zinc-900 pl-9 text-sm text-zinc-400 focus:ring-cyan-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] border-zinc-700 bg-zinc-900">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value="all">All remixes</SelectItem>
              <SelectItem value="recent">Recent remixes</SelectItem>
              <SelectItem value="oldest">Oldest remixes</SelectItem>
              <SelectItem value="a-z">A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        <Button
          className={`rounded-full px-4 ${selectedGenre === "all" ? "bg-cyan-500 text-black" : "bg-zinc-800 text-zinc-300"}`}
          onClick={() => setSelectedGenre("all")}
        >
          All
        </Button>
        {RIFUSSION_GENRES.slice(0, 5).map(genre => (
          <Button
            key={genre}
            className={`rounded-full px-4 ${selectedGenre === genre ? "bg-cyan-500 text-black" : "bg-zinc-800 text-zinc-300"}`}
            onClick={() => setSelectedGenre(genre)}
          >
            {genre.charAt(0).toUpperCase() + genre.slice(1)}
          </Button>
        ))}
      </div>

      <h2 className="mb-6 text-2xl font-bold flex items-center">
        <Music className="mr-2 h-5 w-5 text-cyan-400" />
        Recent Rifussion Remixes
        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-cyan-400" />}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : remixes.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <p className="text-zinc-400">No remixes found. Try a different filter or search term.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {remixes.map((remix) => (
            <div
              key={remix.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <img
                    src={remix.imageUrl || "/placeholder.svg"}
                    alt={remix.title}
                    className="h-16 w-16 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/diverse-group-making-music.png"
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer"
                    onClick={() => handlePlayPause(remix.id)}
                  >
                    {currentlyPlaying === remix.id ? (
                      <Pause className="h-8 w-8 text-white" />
                    ) : (
                      <Play className="h-8 w-8 text-white" />
                    )}
                  </div>
                  {currentlyPlaying === remix.id && (
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-md border-2 border-cyan-500"></div>
                  )}
                </div>
                <div>
                  <div className="flex items-center">
                    <h3 className="font-medium">{remix.title}</h3>
                    {remix.qualityScore >= 80 && (
                      <BadgeCheck className="ml-1 h-4 w-4 text-cyan-400" title="Professional Quality" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {remix.original || `${remix.genre} • ${remix.bpm} BPM`}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-zinc-600">
                    <span>{formatDate(remix.dateCreated)}</span>
                    <span>{formatDuration(remix.duration)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{remix.genre}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
                  onClick={() => handleDownload(remix.id)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
                  onClick={() => handleShare(remix.id)}
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-red-400"
                  onClick={() => handleDelete(remix.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-6 mt-12 text-2xl font-bold flex items-center">
        <Music className="mr-2 h-5 w-5 text-cyan-400" />
        Popular Rifussion Tracks
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : popularRemixes.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <p className="text-zinc-400">No popular tracks found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {popularRemixes.map((remix) => (
            <div
              key={`popular-${remix.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <img
                    src={remix.imageUrl || "/placeholder.svg"}
                    alt={remix.title}
                    className="h-16 w-16 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/diverse-group-making-music.png"
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer"
                    onClick={() => handlePlayPause(remix.id)}
                  >
                    {currentlyPlaying === remix.id ? (
                      <Pause className="h-8 w-8 text-white" />
                    ) : (
                      <Play className="h-8 w-8 text-white" />
                    )}
                  </div>
                  {currentlyPlaying === remix.id && (
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-md border-2 border-cyan-500"></div>
                  )}
                </div>
                <div>
                  <div className="flex items-center">
                    <h3 className="font-medium">{remix.title}</h3>
                    {remix.qualityScore >= 80 && (
                      <BadgeCheck className="ml-1 h-4 w-4 text-cyan-400" title="Professional Quality" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {remix.original || `${remix.genre} • ${remix.bpm} BPM`}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-zinc-600">
                    <span>{formatDate(remix.dateCreated)}</span>
                    <span>{formatDuration(remix.duration)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{remix.genre}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
                  onClick={() => handleDownload(remix.id)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
                  onClick={() => handleShare(remix.id)}
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-red-400"
                  onClick={() => handleDelete(remix.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
