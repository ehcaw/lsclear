"use client";

import { createAuthClient } from "better-auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Chrome,
  Code,
  Play,
  Terminal,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const authClient = createAuthClient();

  const handleSignInWithGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern overlay - moved to style prop to avoid escaping issues */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'><g fill='none' fill-rule='evenodd'><g fill='%239C92AC' fill-opacity='0.05'><circle cx='30' cy='30' r='1'/></g></g></svg>")`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Header Section */}
        <div className="text-center mb-12 max-w-4xl">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full blur-lg opacity-75"></div>
              <div className="relative bg-gradient-to-r from-purple-500 to-blue-500 p-4 rounded-full">
                <Terminal className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-6 leading-tight">
            lsclear
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
            Your powerful online Python IDE. Write, run, and share code instantly.
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-white mr-2" />
              <CardTitle className="text-2xl font-bold text-white">
                Get Started
              </CardTitle>
            </div>
            <CardDescription className="text-slate-300 text-base">
              Sign in to access your coding environment and start building amazing Python projects.
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            <div className="space-y-6">
              <Button
                variant="outline"
                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border-white/20 hover:border-white/30 transition-all duration-200 transform hover:scale-105"
                onClick={handleSignInWithGoogle}
              >
                <Chrome className="w-5 h-5 mr-3" />
                Continue with Google
              </Button>

              <div className="text-center">
                <p className="text-sm text-slate-400">
                  Free to use • No credit card required
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code preview section */}
        <div className="mt-16 max-w-2xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-slate-300" />
                <span className="text-sm text-slate-300 font-medium">main.py</span>
              </div>
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Ready to run</span>
              </div>
            </div>
            <pre className="text-sm text-slate-300 font-mono leading-relaxed">
              <code>{`# Welcome to lsclear!
import numpy as np
import matplotlib.pyplot as plt

function createMagic() {
    const x = Array.from({ length: 100 }, (_, i) => i * (4 * Math.PI) / 99);
    const y = x.map(val => Math.sin(val) * Math.exp(-val / 10));

    // Plotting would happen here in Python context
    console.log(y);
}

createMagic();`}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
        </div>
      </div>
    </div>
  );
}
