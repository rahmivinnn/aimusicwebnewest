"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Share2, Trash2, Search, Music, Wand2, Play, Pause, Loader2, BadgeCheck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { getLibraryTracks, verifyTrackQuality } from "@/app/actions/library-actions"
import { LibraryTrack, RIFUSSION_GENRES, RIFUSSION_MOODS } from "@/lib/rifussion-library-service"

// Client-side formatDuration function to avoid using server action
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function MyLibraryPage() {
  const [filter, setFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([])
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [selectedMood, setSelectedMood] = useState("all")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()

  // Fetch library tracks on component mount and when filters change
  useEffect(() => {
    async function fetchLibraryTracks() {
      setIsLoading(true)
      try {
        const result = await getLibraryTracks({
          filter,
          genre: selectedGenre !== "all" ? selectedGenre : "",
          mood: selectedMood !== "all" ? selectedMood : "",
          search: searchQuery,
          limit: 16
        });

        setLibraryTracks(result.tracks);
      } catch (error) {
        console.error("Error fetching library tracks:", error);
        toast({
          title: "Error",
          description: "Failed to load library. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchLibraryTracks();
  }, [filter, searchQuery, selectedGenre, selectedMood, toast]);

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
        const track = libraryTracks.find(t => t.id === trackId);

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

        // Create a new audio element and play the selected track
        const audio = new Audio(track.audioUrl);
        audio.volume = 0.8; // Set default volume
        audio.onended = () => setCurrentlyPlaying(null);
        audio.onerror = (e) => {
          console.error("Audio error:", e);
          toast({
            title: "Error",
            description: "Failed to play audio. Please try again.",
            variant: "destructive",
          });
          setCurrentlyPlaying(null);
        };

        // Show loading toast
        toast({
          title: "Loading Audio",
          description: "Preparing professional-quality audio...",
        });

        // Play the audio
        await audio.play();

        // Update toast on successful play
        toast({
          title: "Now Playing",
          description: `${track.title} - Professional quality ${track.genre} track`,
        });

        audioRef.current = audio;
        setCurrentlyPlaying(trackId);
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
      const track = libraryTracks.find(t => t.id === trackId);

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
    const track = libraryTracks.find(t => t.id === trackId);

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
    const track = libraryTracks.find(t => t.id === trackId);

    if (!track) {
      toast({
        title: "Error",
        description: "Track not found",
        variant: "destructive",
      });
      return;
    }

    // Remove from local state (in a real app, you would call an API)
    setLibraryTracks(libraryTracks.filter(t => t.id !== trackId));

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

  // Function to render a single track
  const renderTrack = (track: LibraryTrack) => (
    <div
      key={track.id}
      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 hover:bg-zinc-800/30 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="relative group">
          <img
            src={track.imageUrl || "/placeholder.svg"}
            alt={track.title}
            className="h-16 w-16 rounded-md object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/diverse-group-making-music.png"
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer"
            onClick={() => handlePlayPause(track.id)}
          >
            {currentlyPlaying === track.id ? (
              <Pause className="h-8 w-8 text-white" />
            ) : (
              <Play className="h-8 w-8 text-white" />
            )}
          </div>
          {currentlyPlaying === track.id && (
            <div className="absolute inset-0 bg-cyan-500/20 rounded-md border-2 border-cyan-500"></div>
          )}
        </div>
        <div>
          <div className="flex items-center">
            <h3 className="font-medium">{track.title}</h3>
            {track.qualityScore >= 80 && (
              <BadgeCheck className="ml-1 h-4 w-4 text-cyan-400" title="Professional Quality" />
            )}
            {track.type === "remix" ? (
              <Music className="h-4 w-4 ml-2 text-cyan-400" title="Remix" />
            ) : (
              <Wand2 className="h-4 w-4 ml-2 text-purple-400" title="AI Generated" />
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {track.original || `${track.genre} • ${track.bpm} BPM`}
          </p>
          <div className="mt-1 flex items-center gap-4 text-xs text-zinc-600">
            <span>{formatDate(track.dateCreated)}</span>
            <span>{formatDuration(track.duration)}</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{track.genre}</span>
            {track.mood && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{track.mood}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
          onClick={() => handleDownload(track.id)}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
          onClick={() => handleShare(track.id)}
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-red-400"
          onClick={() => handleDelete(track.id)}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rifussion Library</h1>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="search"
              placeholder="Search library"
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
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="recent">Recently added</SelectItem>
              <SelectItem value="remixes">Remixes only</SelectItem>
              <SelectItem value="generated">Generated only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        <Button
          className={`rounded-full px-4 ${selectedGenre === "all" ? "bg-cyan-500 text-black" : "bg-zinc-800 text-zinc-300"}`}
          onClick={() => setSelectedGenre("all")}
        >
          All Genres
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

      <div className="mb-6 flex gap-2 overflow-x-auto">
        <Button
          className={`rounded-full px-4 ${selectedMood === "all" ? "bg-cyan-500 text-black" : "bg-zinc-800 text-zinc-300"}`}
          onClick={() => setSelectedMood("all")}
        >
          All Moods
        </Button>
        {RIFUSSION_MOODS.slice(0, 5).map(mood => (
          <Button
            key={mood}
            className={`rounded-full px-4 ${selectedMood === mood ? "bg-cyan-500 text-black" : "bg-zinc-800 text-zinc-300"}`}
            onClick={() => setSelectedMood(mood)}
          >
            {mood.charAt(0).toUpperCase() + mood.slice(1)}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="all" className="text-lg py-3">
            All Items
          </TabsTrigger>
          <TabsTrigger value="remixes" className="text-lg py-3">
            <Music className="h-4 w-4 mr-2" />
            Remixes
          </TabsTrigger>
          <TabsTrigger value="generated" className="text-lg py-3">
            <Wand2 className="h-4 w-4 mr-2" />
            Generated Audio
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-0">
              {libraryTracks.length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
                  <p className="text-zinc-400">No tracks found. Try a different filter or search term.</p>
                </div>
              ) : (
                <div className="space-y-4">{libraryTracks.map(renderTrack)}</div>
              )}
            </TabsContent>

            <TabsContent value="remixes" className="mt-0">
              {libraryTracks.filter(track => track.type === "remix").length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
                  <p className="text-zinc-400">No remixes found. Try a different filter or search term.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {libraryTracks.filter(track => track.type === "remix").map(renderTrack)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="generated" className="mt-0">
              {libraryTracks.filter(track => track.type === "generated").length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
                  <p className="text-zinc-400">No generated tracks found. Try a different filter or search term.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {libraryTracks.filter(track => track.type === "generated").map(renderTrack)}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
