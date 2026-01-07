import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  Trash2,
  PencilLine,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { deleteAudioTrack, getAudioTracks, updateAudioTrack, uploadAudioTrack } from "@/lib/api";

type Track = {
  id: number;
  title: string;
  album: string | null;
  fileUrl?: string | null;
  durationSec?: number | null;
};

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "--:--";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseTitleFromFile(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

async function getDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(audio.duration || 0);
      audio.onerror = () => resolve(0);
      audio.src = url;
    });
    return Math.round(duration || 0);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AudioFooter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isFooterHidden, setIsFooterHidden] = useState(false);
  const [album, setAlbum] = useState("");
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isRepeating, setIsRepeating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: tracks = [] } = useQuery({
    queryKey: ["audio-tracks"],
    queryFn: getAudioTracks,
    enabled: !!user,
  });

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentId) || tracks[0] || null,
    [currentId, tracks]
  );

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploads = [];
      for (const file of files) {
        const durationSec = await getDuration(file);
        const resolvedTitle = files.length > 1 ? parseTitleFromFile(file.name) : title.trim() || parseTitleFromFile(file.name);
        uploads.push(
          uploadAudioTrack({
            file,
            title: resolvedTitle,
            album: album.trim() || null,
            durationSec,
          })
        );
      }
      return Promise.all(uploads);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-tracks"] });
      setAlbum("");
      setTitle("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateAudioTrack(editingId!, {
        title: editTitle.trim(),
        album: editAlbum.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-tracks"] });
      setEditingId(null);
      setEditTitle("");
      setEditAlbum("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAudioTrack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-tracks"] });
      setCurrentId((prev) => (prev ? (prev === currentTrack?.id ? null : prev) : prev));
    },
  });

  useEffect(() => {
    if (!currentTrack && tracks.length > 0) {
      setCurrentId(tracks[0].id);
    }
  }, [currentTrack, tracks]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!currentTrack?.fileUrl) return;
    audioRef.current.src = currentTrack.fileUrl;
    audioRef.current.load();
    setProgress(0);
    setDuration(0);
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack?.fileUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.fileUrl) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack?.fileUrl, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTime = () => setProgress(audio.currentTime || 0);
    const handleDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      if (isRepeating) {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
        return;
      }
      const index = tracks.findIndex((track) => track.id === currentTrack?.id);
      if (index !== -1 && index < tracks.length - 1) {
        setCurrentId(tracks[index + 1].id);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("loadedmetadata", handleDuration);
    audio.addEventListener("ended", handleEnded);
    const handleError = () => {
      queryClient.invalidateQueries({ queryKey: ["audio-tracks"] });
    };
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("loadedmetadata", handleDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [currentTrack?.id, isRepeating, queryClient, tracks]);

  useEffect(() => {
    document.body.classList.toggle("app-footer-hidden", isFooterHidden);
    return () => {
      document.body.classList.remove("app-footer-hidden");
    };
  }, [isFooterHidden]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.fileUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setProgress(value);
  };

  const handleSkip = (direction: "next" | "prev") => {
    if (!tracks.length) return;
    const index = tracks.findIndex((track) => track.id === currentTrack?.id);
    if (index === -1) {
      setCurrentId(tracks[0].id);
      return;
    }
    if (direction === "next" && index < tracks.length - 1) {
      setCurrentId(tracks[index + 1].id);
    }
    if (direction === "prev" && index > 0) {
      setCurrentId(tracks[index - 1].id);
    }
  };

  const startEdit = (track: Track) => {
    setEditingId(track.id);
    setEditTitle(track.title);
    setEditAlbum(track.album || "");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <audio ref={audioRef} />
      {!isFooterHidden && (
      <div className="relative border-t border-white/10 bg-gradient-to-r from-black via-zinc-950 to-black px-4 pt-3 pb-4">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.18),_transparent_55%)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md border border-white/10 bg-white/5 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-primary" />
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {[0, 1, 2].map((index) => (
                <motion.span
                  key={index}
                  className="w-0.5 bg-primary/80 rounded-full"
                  animate={isPlaying ? { height: [6, 14, 8] } : { height: 6 }}
                  transition={{
                    duration: 0.9,
                    repeat: isPlaying ? Infinity : 0,
                    delay: index * 0.1,
                  }}
                />
              ))}
            </div>
            <div className="min-w-[160px] max-w-[220px]">
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Now Playing</p>
              <p className="text-sm text-white truncate">{currentTrack?.title || "No track selected"}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest truncate">
                {currentTrack?.album || "Personal Library"}
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSkip("prev")}
                className="text-white/50 hover:text-white"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                onClick={togglePlay}
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-black"
                disabled={!currentTrack?.fileUrl}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSkip("next")}
                className="text-white/50 hover:text-white"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRepeating((prev) => !prev)}
                className={isRepeating ? "text-primary hover:text-primary" : "text-white/50 hover:text-white"}
                title={isRepeating ? "Repeat on" : "Repeat off"}
              >
                <span className="text-xs font-mono uppercase tracking-widest">R</span>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 font-mono w-10">{formatTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(progress, duration || 0)}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-[10px] text-white/40 font-mono w-10 text-right">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-white/40" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-primary"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFooterHidden((prev) => !prev)}
              className="text-white/60 hover:text-white"
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              Hide Player
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen((prev) => !prev)}
              className="text-white/60 hover:text-white"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronUp className="w-4 h-4 mr-1" />}
              Library
            </Button>
          </div>
        </div>
      </div>
      )}

      <AnimatePresence>
        {isOpen && !isFooterHidden && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/10 bg-black/95 backdrop-blur-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Personal Library</p>
                <h3 className="text-white text-lg">Upload audio or build an album</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-white/50">
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_2fr]">
              <div className="border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Upload</p>
                <div className="space-y-3">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Track title (optional)"
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                  />
                  <input
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="Album name (optional)"
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                      className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Add Audio
                    </Button>
                  </div>
                  <p className="text-[10px] text-white/40">
                    Select one file for a single track or multiple files to create an album.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    uploadMutation.mutate(files);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
              </div>

              <div className="border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Tracks</p>
                {tracks.length === 0 ? (
                  <p className="text-sm text-white/40">No audio yet.</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                    {tracks.map((track) => {
                      const isActive = track.id === currentTrack?.id;
                      const isEditing = editingId === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`border border-white/10 p-3 ${isActive ? "bg-primary/10 border-primary/40" : "bg-white/5"}`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                              />
                              <input
                                value={editAlbum}
                                onChange={(e) => setEditAlbum(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateMutation.mutate()}
                                  disabled={updateMutation.isPending || !editTitle.trim()}
                                  className="bg-primary hover:bg-primary/90 text-black text-xs"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditTitle("");
                                    setEditAlbum("");
                                  }}
                                  className="text-white/50 hover:text-white"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-white">{track.title}</p>
                                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                                    {track.album || "Untitled Album"} - {formatTime(track.durationSec || 0)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setCurrentId(track.id);
                                      setIsPlaying(true);
                                    }}
                                    className="text-white/50 hover:text-primary"
                                  >
                                    <Play className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEdit(track)}
                                    className="text-white/50 hover:text-primary"
                                  >
                                    <PencilLine className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMutation.mutate(track.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isFooterHidden && (
        <button
          type="button"
          onClick={() => setIsFooterHidden(false)}
          className="absolute right-3 bottom-3 px-3 py-2 bg-black/80 border border-white/10 text-xs font-mono uppercase tracking-widest text-white/70 hover:text-white"
        >
          Show Player
        </button>
      )}
    </div>
  );
}
