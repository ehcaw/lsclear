import React, { useEffect, useRef, useState } from "react";
import { useXTerm } from "react-xtermjs";
import { FitAddon } from "@xterm/addon-fit";

interface TerminalComponentProps {
  userId: string;
  apiBaseUrl?: string;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  userId,
  apiBaseUrl = process.env.NEXT_PUBLIC_REACT_APP_API_URL || "",
}) => {
  console.log("Terminal render");

  // State for UI only
  const [status, setStatus] = useState("Initializing");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Refs to prevent re-renders and maintain stable values
  const initializedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const userIdRef = useRef(userId);
  const apiBaseUrlRef = useRef(apiBaseUrl);

  // Update refs without triggering re-renders
  userIdRef.current = userId;
  apiBaseUrlRef.current = apiBaseUrl;

  // Terminal setup - outside of any effects
  const { instance, ref: xtermRef } = useXTerm({
    options: { cursorBlink: true, fontFamily: "monospace" },
  });

  // Store instance in ref to avoid dependency changes
  const instanceRef = useRef(instance);
  instanceRef.current = instance;

  // Primary setup effect - CRITICALLY: no dependencies that change
  useEffect(() => {
    // Wait until we have the necessary pieces
    if (!instanceRef.current || !xtermRef.current || initializedRef.current) {
      return;
    }

    console.log("Terminal one-time setup");
    initializedRef.current = true;

    // Create fit addon
    if (!fitAddonRef.current) {
      fitAddonRef.current = new FitAddon();
      instanceRef.current.loadAddon(fitAddonRef.current);
    }

    // Set up resize observer
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && !document.hidden) {
        setTimeout(() => fitAddonRef.current.fit(), 0);
      }
    });

    if (xtermRef.current) {
      observer.observe(xtermRef.current);
    }

    // Initial fit
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);

    // Terminal connection logic
    const setupTerminalConnection = async () => {
      if (!userIdRef.current) return;

      try {
        setStatus("Starting");

        // Start terminal session
        const response = await fetch(
          `${apiBaseUrlRef.current}/terminal/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userIdRef.current }),
          },
        );

        if (!response.ok) throw new Error("Failed to start terminal");

        const data = await response.json();
        const sid = data.session_id;
        setSessionId(sid);

        // Setup WebSocket
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${protocol}://${apiBaseUrlRef.current}/terminal/ws/${sid}`;

        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          if (instanceRef.current) {
            instanceRef.current.writeln("\r\n*** Connected to sandbox ***");
            setStatus("Connected");
          }
        };

        ws.onmessage = (evt) => {
          if (instanceRef.current) {
            const data =
              evt.data instanceof ArrayBuffer
                ? new TextDecoder().decode(evt.data)
                : evt.data;
            instanceRef.current.write(data);
          }
        };

        ws.onclose = () => {
          if (instanceRef.current) {
            instanceRef.current.writeln("\r\n*** Connection closed ***");
            setStatus("Disconnected");
          }
        };

        // Handle terminal input
        if (instanceRef.current) {
          instanceRef.current.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          });
        }
      } catch (error) {
        console.error("Terminal error:", error);
        setStatus("Error");
        if (instanceRef.current) {
          instanceRef.current.writeln("\r\n*** Terminal error ***");
        }
      }
    };

    // Start connection
    setupTerminalConnection();

    // Cleanup
    return () => {
      console.log("Terminal cleanup");
      observer.disconnect();

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (sessionId) {
        fetch(`${apiBaseUrlRef.current}/terminal/${sessionId}`, {
          method: "DELETE",
        }).catch(console.error);
      }
    };
  }, []); // ⚠️ EMPTY dependency array - only runs once!

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 text-white p-2 text-sm">
        Status: {status}
        {sessionId && ` (Session: ${sessionId.substring(0, 8)}...)`}
      </div>
      <div ref={xtermRef} className="flex-1 bg-black" />
    </div>
  );
};

export default TerminalComponent;
