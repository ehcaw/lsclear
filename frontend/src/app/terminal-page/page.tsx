// src/app/terminal-page/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function TerminalPage() {
  // Get URL parameters
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const apiBaseUrl = searchParams.get("apiBaseUrl") || "";

  // UI state only
  const [statusText, setStatusText] = useState("Initializing");

  // Refs for DOM and objects
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Initialize terminal once
  useEffect(() => {
    // Skip if already initialized or no container
    if (xtermRef.current || !terminalRef.current || !userId) return;

    console.log("Initializing terminal with xterm.js directly");

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
      theme: {
        background: "#000000",
        foreground: "#ffffff",
      },
    });

    // Store in ref
    xtermRef.current = terminal;

    // Create fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // Open terminal in the container
    terminal.open(terminalRef.current);

    // Initial fit
    setTimeout(() => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    }, 100);

    // Setup resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Connect to backend
    async function setupConnection() {
      try {
        setStatusText("Starting session...");

        // Start terminal session
        const response = await fetch(`${apiBaseUrl}/terminal/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });

        if (!response.ok) throw new Error("Failed to start terminal session");

        const data = await response.json();
        const sessionId = data.session_id;
        sessionIdRef.current = sessionId;

        setStatusText("Connecting...");

        // Connect WebSocket
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${protocol}://${window.location.host}${apiBaseUrl}/terminal/ws/${sessionId}`;

        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          if (xtermRef.current) {
            xtermRef.current.writeln("\r\n*** Connected to sandbox ***");
            setStatusText("Connected");
          }
        };

        ws.onmessage = (evt) => {
          if (xtermRef.current) {
            const data =
              evt.data instanceof ArrayBuffer
                ? new TextDecoder().decode(evt.data)
                : evt.data;
            xtermRef.current.write(data);
          }
        };

        ws.onclose = () => {
          if (xtermRef.current) {
            xtermRef.current.writeln("\r\n*** Connection closed ***");
            setStatusText("Disconnected");
          }
        };

        // Handle terminal input
        if (xtermRef.current) {
          xtermRef.current.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          });
        }
      } catch (error) {
        console.error("Terminal connection error:", error);
        setStatusText("Error");
        if (xtermRef.current) {
          xtermRef.current.writeln("\r\n*** Error connecting to terminal ***");
        }
      }
    }

    // Start connection
    setupConnection();

    // Cleanup function
    return () => {
      console.log("Cleaning up terminal");
      resizeObserver.disconnect();

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (sessionIdRef.current) {
        fetch(`${apiBaseUrl}/terminal/${sessionIdRef.current}`, {
          method: "DELETE",
        }).catch(console.error);
      }

      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures it only runs once

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="bg-gray-800 text-white p-2 text-sm">
        Status: {statusText}
        {sessionIdRef.current &&
          ` (Session: ${sessionIdRef.current.substring(0, 8)}...)`}
      </div>
      <div ref={terminalRef} className="flex-1" />
    </div>
  );
}
