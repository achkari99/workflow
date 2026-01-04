import { motion } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { getUserProfile, updateUserProfile } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, PenSquare, Sparkles, ShieldCheck, Zap } from "lucide-react";

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    profileImageUrl: "",
  });

  if (!user) {
    navigate("/auth");
    return null;
  }

  const profileId = params?.id || user.id;
  const isSelf = profileId === user.id;

  const { data: profileUser, isLoading } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getUserProfile(profileId),
    enabled: !isSelf,
  });

  useEffect(() => {
    const source = isSelf ? user : profileUser;
    if (!source) return;
    setProfileForm({
      firstName: source.firstName || "",
      lastName: source.lastName || "",
      email: source.email || "",
      username: source.username || "",
      profileImageUrl: source.profileImageUrl || "",
    });
  }, [user, profileUser, isSelf]);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      username?: string | null;
      profileImageUrl?: string | null;
    }) => updateUserProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/user"], updated);
      toast({ title: "Profile updated", description: "Your settings are saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const activeProfile = isSelf ? user : profileUser;
  const displayName = activeProfile?.firstName || activeProfile?.username || activeProfile?.email || "Operator";
  const secondary = activeProfile?.email || activeProfile?.username || "No email on file";
  const initials = (activeProfile?.firstName?.[0] || activeProfile?.username?.[0] || activeProfile?.email?.[0] || "U").toUpperCase();
  const avatarUrl = profileForm.profileImageUrl || activeProfile?.profileImageUrl || "";

  return (
    <div className="min-h-screen bg-[#060707] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,181,255,0.12),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(126,244,202,0.14),_transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.1] bg-[linear-gradient(120deg,_rgba(255,255,255,0.06)_0%,_transparent_50%,_rgba(255,255,255,0.04)_100%)]" />

      <header className="h-14 border-b border-white/5 bg-black/40 flex items-center justify-between px-4 relative z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-white/60 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Home
        </Button>
        <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/40">
          {isSelf ? "Profile Core" : "Operator Profile"}
        </div>
        <div className="text-white/30 text-xs">Synced</div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {isLoading && !isSelf ? (
          <div className="text-white/50 text-sm">Loading profile...</div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="border border-white/10 bg-black/60 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(126,244,202,0.08),_transparent_60%)]" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Operator</p>
                <h1 className="text-3xl font-oxanium mt-3">{displayName}</h1>
                <p className="text-white/50 mt-2">{secondary}</p>
              </div>
              <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl font-oxanium overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {isSelf && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute top-6 right-6 h-9 w-9 rounded-full border border-white/10 bg-black/60 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30"
                    aria-label="Upload profile image"
                  >
                    <PenSquare className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = typeof reader.result === "string" ? reader.result : "";
                        const nextProfile = { ...profileForm, profileImageUrl: result };
                        setProfileForm(nextProfile);
                        updateMutation.mutate({
                          firstName: nextProfile.firstName || null,
                          lastName: nextProfile.lastName || null,
                          email: nextProfile.email || null,
                          username: nextProfile.username || null,
                          profileImageUrl: nextProfile.profileImageUrl || null,
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </>
              )}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Mission Pace</p>
                <p className="text-2xl font-oxanium mt-3">Fast</p>
              </div>
              <div className="border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Focus Mode</p>
                <p className="text-2xl font-oxanium mt-3">On</p>
              </div>
              <div className="border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Session Sync</p>
                <p className="text-2xl font-oxanium mt-3">Active</p>
              </div>
            </div>

            <div className="mt-8 border border-white/10 bg-gradient-to-br from-white/5 via-black/50 to-black/80 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Signal Strength</p>
                  <p className="text-lg font-oxanium mt-2">Operational</p>
                </div>
                <Sparkles className="w-6 h-6 text-[#8ef5d1]" />
              </div>
              <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-[#8ef5d1]" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-white/10 bg-black/50 p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-[#7cb5ff]" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Identity Settings</p>
                  <p className="text-lg font-oxanium mt-1">Live Profile</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-first" className="text-white/60 text-xs uppercase tracking-widest font-mono">First Name</Label>
                    <Input
                      id="profile-first"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className="bg-black/40 border-white/10 focus:border-[#8ef5d1]"
                      placeholder="First name"
                      disabled={!isSelf}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-last" className="text-white/60 text-xs uppercase tracking-widest font-mono">Last Name</Label>
                    <Input
                      id="profile-last"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className="bg-black/40 border-white/10 focus:border-[#8ef5d1]"
                      placeholder="Last name"
                      disabled={!isSelf}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-username" className="text-white/60 text-xs uppercase tracking-widest font-mono">Username</Label>
                  <Input
                    id="profile-username"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="bg-black/40 border-white/10 focus:border-[#8ef5d1]"
                    placeholder="Username"
                    disabled={!isSelf}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email" className="text-white/60 text-xs uppercase tracking-widest font-mono">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="bg-black/40 border-white/10 focus:border-[#8ef5d1]"
                    placeholder="email@domain.com"
                    disabled={!isSelf}
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-xs text-white/40 font-mono uppercase tracking-widest">
                  {updateMutation.isPending ? "Saving..." : "Ready"}
                </div>
                {isSelf && (
                  <Button
                    onClick={() =>
                      updateMutation.mutate({
                        firstName: profileForm.firstName || null,
                        lastName: profileForm.lastName || null,
                        email: profileForm.email || null,
                        username: profileForm.username || null,
                        profileImageUrl: profileForm.profileImageUrl || null,
                      })
                    }
                    disabled={updateMutation.isPending}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-widest"
                  >
                    Save Profile
                  </Button>
                )}
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="border border-white/10 bg-gradient-to-br from-[#0a1114] via-black to-[#070909] p-6"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-[#8ef5d1]" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Momentum</p>
                  <p className="text-lg font-oxanium mt-1">Peak Hours</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`pulse-${index}`}
                    className={`h-12 border border-white/10 ${index % 2 === 0 ? "bg-[#8ef5d1]/20" : "bg-white/5"}`}
                  />
                ))}
              </div>
              <p className="text-white/40 text-xs mt-4">Tap into your strongest collaboration windows.</p>
            </motion.div>
          </div>
        </motion.div>
        )}
      </div>
    </div>
  );
}
