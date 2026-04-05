"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceInput({ onResult, className }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, [onResult]);

  function toggle() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon"
      onClick={toggle}
      className={cn(
        "cursor-pointer shrink-0 relative",
        listening && "bg-red-500 hover:bg-red-600 text-white",
        className
      )}
      title="Nhấn để nói, VD: ăn phở 50 nghìn"
    >
      {listening ? (
        <>
          <MicOff className="h-4 w-4" />
          {/* Pulse animation when listening */}
          <span className="absolute inset-0 rounded-md animate-ping bg-red-500/30" />
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
