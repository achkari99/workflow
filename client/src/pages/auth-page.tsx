import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, Loader2, Mail, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function AuthPage() {
    const { user, isLoading, loginMutation, registerMutation } = useAuth();
    const [, setLocation] = useLocation();
    const [activeTab, setActiveTab] = useState<"login" | "register">("login");
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [resetEmail, setResetEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    const [resetError, setResetError] = useState("");
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [isResetPending, setIsResetPending] = useState(false);

    useEffect(() => {
        if (user) {
            setLocation("/");
        }
    }, [user, setLocation]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#070909] text-white">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoginError("");
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        loginMutation.mutate(data, {
            onError: () => setLoginError("Wrong username or password."),
        });
    };

    const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        registerMutation.mutate(data);
    };

    const handleForgotPassword = async () => {
        setResetError("");
        setResetMessage("");
        if (!resetEmail.trim()) {
            setResetError("Enter the email connected to your account.");
            return;
        }
        setIsResetPending(true);

        try {
            const res = await fetch("/api/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: resetEmail }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Password reset request failed");
            }

            setResetMessage("If an account exists, check your email for the reset link.");
        } catch {
            setResetError("Could not request a reset email. Check the address and try again.");
        } finally {
            setIsResetPending(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative bg-[#070909] text-white"
            style={{
                "--auth-accent": "#8ef5d1",
                "--auth-accent-2": "#7cb5ff",
                "--auth-ink": "#0b0f0e",
            } as CSSProperties}
        >
            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(126,244,202,0.12),_transparent_55%)]" />
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_bottom,_rgba(124,181,255,0.16),_transparent_55%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(255,255,255,0.04)_0%,_transparent_45%,_rgba(255,255,255,0.03)_100%)]" />
            <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle,_rgba(255,255,255,0.4)_1px,_transparent_1px)] bg-[length:18px_18px]" />

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.1fr_1fr] rounded-[30px] overflow-hidden border border-cyan-300/10 bg-[#0b0f10]/80 backdrop-blur-xl shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_30px_120px_rgba(0,0,0,0.65),0_0_80px_rgba(20,184,166,0.08)] relative z-10"
            >
                <div className="p-8 md:p-12 flex flex-col justify-between gap-10 bg-[linear-gradient(160deg,_rgba(12,20,22,0.96)_10%,_rgba(8,8,10,0.92)_100%)] border-r border-white/10">
                    <div>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[color:var(--auth-accent)] text-[color:var(--auth-ink)] shadow-[0_0_30px_rgba(126,244,202,0.45)]">
                                <Zap className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.35em] text-white/50 font-mono">System Gate</p>
                                <h1 className="text-2xl font-oxanium tracking-tight">Living Workflow</h1>
                            </div>
                        </div>

                        <h2 className="text-3xl font-oxanium leading-tight text-white mb-4">
                            Command your missions with clarity and momentum.
                        </h2>
                        <p className="text-white/50 text-sm max-w-md">
                            A focused workspace for teams that need precision, velocity, and visibility across every phase.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-white/50">
                            <span className="h-2 w-2 rounded-full bg-[color:var(--auth-accent)] shadow-[0_0_12px_rgba(126,244,202,0.7)]" />
                            Core systems online
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs text-white/50">
                            <div className="border border-cyan-300/10 bg-white/[0.04] p-4 shadow-[0_0_30px_rgba(20,184,166,0.06)]">
                                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Active Missions</p>
                                <p className="text-xl font-oxanium text-white mt-2">Realtime</p>
                            </div>
                            <div className="border border-blue-300/10 bg-white/[0.04] p-4 shadow-[0_0_30px_rgba(59,130,246,0.06)]">
                                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Live Sessions</p>
                                <p className="text-xl font-oxanium text-white mt-2">Synchronized</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 md:p-12 bg-black/50">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 font-mono">Access Node</p>
                            <h3 className="text-2xl font-oxanium">Authenticate</h3>
                        </div>
                        <ShieldCheck className="w-7 h-7 text-[color:var(--auth-accent-2)]" />
                    </div>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] p-1 rounded-none mb-8 border border-white/10">
                            <TabsTrigger value="login" className="rounded-none data-[state=active]:bg-cyan-300/10 data-[state=active]:text-[color:var(--auth-accent)] font-mono uppercase tracking-widest text-xs">Login</TabsTrigger>
                            <TabsTrigger value="register" className="rounded-none data-[state=active]:bg-blue-300/10 data-[state=active]:text-[color:var(--auth-accent-2)] font-mono uppercase tracking-widest text-xs">Register</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-white/60 font-mono uppercase tracking-widest text-xs">Username</Label>
                                    <Input
                                        id="username"
                                        name="username"
                                        placeholder="core_operator"
                                        className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent)] h-12"
                                        onChange={() => setLoginError("")}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-white/60 font-mono uppercase tracking-widest text-xs">Password</Label>
                                        <button
                                            type="button"
                                            className="text-[11px] text-cyan-200/70 hover:text-cyan-200 font-mono uppercase tracking-widest"
                                            onClick={() => setIsResetOpen((value) => !value)}
                                        >
                                            Forgot?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            name="password"
                                            type={showLoginPassword ? "text" : "password"}
                                            placeholder="********"
                                            className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent)] h-12 pr-12"
                                            onChange={() => setLoginError("")}
                                            required
                                        />
                                        <button
                                            type="button"
                                            aria-label={showLoginPassword ? "Hide password" : "Show password"}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-[color:var(--auth-accent)] transition-colors"
                                            onClick={() => setShowLoginPassword((value) => !value)}
                                        >
                                            {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                                {loginError && (
                                    <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{loginError}</span>
                                    </div>
                                )}
                                {isResetOpen && (
                                    <div className="border border-cyan-300/10 bg-cyan-300/[0.04] p-4 space-y-3 shadow-[0_0_35px_rgba(20,184,166,0.08)]">
                                        <div className="flex items-center gap-2 text-cyan-100">
                                            <Mail className="h-4 w-4" />
                                            <p className="text-xs font-mono uppercase tracking-widest">Email Reset</p>
                                        </div>
                                        <div className="space-y-3">
                                            <Input
                                                type="email"
                                                value={resetEmail}
                                                onChange={(e) => {
                                                    setResetEmail(e.target.value);
                                                    setResetError("");
                                                    setResetMessage("");
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        void handleForgotPassword();
                                                    }
                                                }}
                                                placeholder="you@example.com"
                                                className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent)] h-11"
                                                required
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full border-cyan-300/20 bg-black/30 text-cyan-100 hover:bg-cyan-300/10 h-10 font-mono uppercase tracking-widest text-xs"
                                                disabled={isResetPending}
                                                onClick={handleForgotPassword}
                                            >
                                                {isResetPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Verification Email"}
                                            </Button>
                                        </div>
                                        {resetMessage && <p className="text-xs text-emerald-300">{resetMessage}</p>}
                                        {resetError && <p className="text-xs text-red-300">{resetError}</p>}
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    className="w-full mt-6 bg-[color:var(--auth-accent)] hover:bg-[#9ff8dc] text-black font-bold h-12 tracking-widest uppercase text-xs"
                                    disabled={loginMutation.isPending}
                                >
                                    {loginMutation.isPending ? <Loader2 className="animate-spin" /> : "Enter Command"}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register">
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName" className="text-white/60 font-mono uppercase tracking-widest text-xs">First Name</Label>
                                        <Input id="firstName" name="firstName" placeholder="Alex" className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent-2)] h-12" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName" className="text-white/60 font-mono uppercase tracking-widest text-xs">Last Name</Label>
                                        <Input id="lastName" name="lastName" placeholder="Smith" className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent-2)] h-12" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-username" className="text-white/60 font-mono uppercase tracking-widest text-xs">Username</Label>
                                    <Input id="reg-username" name="username" placeholder="core_operator" className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent-2)] h-12" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-white/60 font-mono uppercase tracking-widest text-xs">Email</Label>
                                    <Input id="email" name="email" type="email" placeholder="alex@command.io" className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent-2)] h-12" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-password" className="text-white/60 font-mono uppercase tracking-widest text-xs">Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="reg-password"
                                            name="password"
                                            type={showRegisterPassword ? "text" : "password"}
                                            placeholder="********"
                                            className="bg-black/40 border-white/10 focus:border-[color:var(--auth-accent-2)] h-12 pr-12"
                                            required
                                        />
                                        <button
                                            type="button"
                                            aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-[color:var(--auth-accent-2)] transition-colors"
                                            onClick={() => setShowRegisterPassword((value) => !value)}
                                        >
                                            {showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full mt-6 bg-[color:var(--auth-accent-2)] hover:bg-[#93c5ff] text-[#0b0f10] font-bold h-12 tracking-widest uppercase text-xs"
                                    disabled={registerMutation.isPending}
                                >
                                    {registerMutation.isPending ? <Loader2 className="animate-spin" /> : "Create Profile"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>
            </motion.div>
        </div>
    );
}
