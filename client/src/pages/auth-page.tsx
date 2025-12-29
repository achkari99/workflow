import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function AuthPage() {
    const { user, loginMutation, registerMutation } = useAuth();
    const [, setLocation] = useLocation();
    const [activeTab, setActiveTab] = useState<"login" | "register">("login");

    if (user) {
        setLocation("/");
        return null;
    }

    const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        loginMutation.mutate(data);
    };

    const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        registerMutation.mutate(data);
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-lime-500/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative z-10"
            >
                <div className="p-8 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-lime-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(132,204,22,0.4)]">
                            <Zap className="text-black w-6 h-6 fill-current" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white font-oxanium uppercase">Living Workflow</span>
                    </div>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-black/50 p-1 rounded-xl mb-8">
                            <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-zinc-800">Login</TabsTrigger>
                            <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-zinc-800">Explore</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input id="username" name="username" placeholder="quantum_explorer" className="bg-black/50 border-white/10" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Security Protocol (Password)</Label>
                                    <Input id="password" name="password" type="password" placeholder="••••••••" className="bg-black/50 border-white/10" required />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full mt-6 bg-lime-500 hover:bg-lime-400 text-black font-bold h-12"
                                    disabled={loginMutation.isPending}
                                >
                                    {loginMutation.isPending ? <Loader2 className="animate-spin" /> : "Initiate Connection"}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register">
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input id="firstName" name="firstName" placeholder="Alex" className="bg-black/50 border-white/10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input id="lastName" name="lastName" placeholder="Smith" className="bg-black/50 border-white/10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-username">Username</Label>
                                    <Input id="reg-username" name="username" placeholder="quantum_explorer" className="bg-black/50 border-white/10" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" name="email" type="email" placeholder="alex@quantum.xyz" className="bg-black/50 border-white/10" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-password">Security Protocol (Password)</Label>
                                    <Input id="reg-password" name="password" type="password" placeholder="••••••••" className="bg-black/50 border-white/10" required />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full mt-6 bg-blue-500 hover:bg-blue-400 text-white font-bold h-12"
                                    disabled={registerMutation.isPending}
                                >
                                    {registerMutation.isPending ? <Loader2 className="animate-spin" /> : "Deploy Agent"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="hidden md:flex p-12 bg-white/5 flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-20">
                        <ShieldCheck className="w-64 h-64 text-lime-500" />
                    </div>

                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold text-white mb-6 font-oxanium leading-tight">
                            WELCOME TO YOUR <br />
                            <span className="text-lime-500 uppercase tracking-widest">Mission Control</span>
                        </h2>
                        <div className="space-y-6 text-zinc-400">
                            <p className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-lime-500/10 flex items-center justify-center shrink-0 text-lime-500 mt-1">1</span>
                                <span>Track complex workflows with real-time status updates and priority markers.</span>
                            </p>
                            <p className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-lime-500/10 flex items-center justify-center shrink-0 text-lime-500 mt-1">2</span>
                                <span>Manage intel documents and stakeholder approvals in a sleek, gamified interface.</span>
                            </p>
                            <p className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-lime-500/10 flex items-center justify-center shrink-0 text-lime-500 mt-1">3</span>
                                <span>Experience work like a mission—bold, interactive, and high-momentum.</span>
                            </p>
                        </div>
                    </div>

                    <div className="pt-12 border-t border-white/10 mt-auto relative z-10">
                        <p className="text-sm text-zinc-500 uppercase tracking-widest font-oxanium mb-2">System Status</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                            <span className="text-xs font-mono text-zinc-400 italic">Core operational. Awaiting authentication...</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
