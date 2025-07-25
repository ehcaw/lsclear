"use client"
import { createAuthClient } from "better-auth/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chrome, Code, Play } from "lucide-react";

export default function LoginPage() {
  const authClient = createAuthClient();

  const handleSignInWithGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-800 mb-3">lsclear</h1>
          <p className="text-lg text-slate-600">Your online Python development environment</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Login Card */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl text-slate-800">Get Started</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleSignInWithGoogle}
                  className="w-full h-12 text-base bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <Chrome className="w-5 h-5 mr-3" />
                  Continue with Google
                </Button>
                <p className="text-sm text-slate-500 text-center mt-4">
                  Completely free • Start coding in seconds
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4 text-center text-sm text-slate-500">
              <div className="space-y-1">
                <div className="font-medium">Fast</div>
                <div className="text-xs">Quick setup</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Secure</div>
                <div className="text-xs">Private by default</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Powerful</div>
                <div className="text-xs">Full Python support</div>
              </div>
            </div>
          </div>

          {/* Code Preview */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center text-sm text-slate-300">
                <Code className="w-4 h-4 mr-2" />
                main.py
              </div>
              <div className="flex items-center text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
                <Play className="w-3 h-3 mr-1" />
                Run
              </div>
            </div>
            <div className="bg-[#1e1e1e] p-4 overflow-x-auto">
              <pre className="text-xs text-gray-300 font-mono leading-relaxed">
                <code>
                  {`# Welcome to lsclear!
import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple

def generate_wave_data() -> Tuple[np.ndarray, np.ndarray]:
    """Generate sample wave data for visualization"""
    x = np.linspace(0, 4 * np.pi, 200)
    y = np.sin(x) * np.exp(-x/10)  # Damped sine wave
    return x, y

def plot_wave(x: np.ndarray, y: np.ndarray) -> None:
    """Plot and display the wave"""
    plt.figure(figsize=(10, 4))
    plt.plot(x, y, 'b-', linewidth=2, label='Damped Sine Wave')
    plt.title('Damped Sine Wave')
    plt.xlabel('Time')
    plt.ylabel('Amplitude')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    # Generate and plot the data
    x, y = generate_wave_data()
    plot_wave(x, y)
    
    # Show some statistics
    print(f"Data points generated: {len(x)}")
    print(f"Max amplitude: {y.max():.4f}")
    print(f"Min amplitude: {y.min():.4f}")`}
                </code>
              </pre>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}