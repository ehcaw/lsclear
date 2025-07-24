"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <HelpCircle className="h-4 w-4" />
          <span className="sr-only">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Quick Help & Guidelines
          </DialogTitle>
          <DialogDescription>
            Everything you need to know to get started
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <h3 className="font-medium mb-2">Code Editor</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Use <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono">Ctrl+S</kbd> or <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono">⌘+S</kbd> to save your files</li>
              <li>Right-click in the editor for additional options</li>
              <li>Use the file tree to navigate between files</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Terminal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Run Python files with <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">python filename.py</code></li>
              <li>Install packages with <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">pip install package-name</code></li>
              <li>Click the refresh button if you encounter connection issues</li>
              <li>Use <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono">Ctrl+C</kbd> to stop a running process</li>
              <li>Clear the terminal with <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">clear</code> or <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono">Ctrl+L</kbd></li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">File Management</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Use the file tree to navigate between files</li>
                <li>Manage files with the terminal using <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">touch filename</code></li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Troubleshooting</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>If the terminal disconnects, try refreshing the page</li>
              <li>Check the browser console for error messages (F12)</li>
              <li>Make sure your code is saved before running it</li>
              <li>Restart your session if you encounter persistent issues</li>
            </ul>
        </div>

          <div className="pt-2 text-xs text-muted-foreground border-t">
            <p>Need more help? Contact support if you encounter any issues.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}