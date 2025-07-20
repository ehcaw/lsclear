"use client";
import dynamic from 'next/dynamic';

// Disable SSR for the Monaco Editor since it uses browser APIs
const MonacoEditor = dynamic(
  () => import('./editor').then(mod => mod.default),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">
          Loading editor...
        </div>
      </div>
    )
  }
);

export default MonacoEditor;
