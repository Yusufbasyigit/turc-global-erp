"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PROFORMA_EXTRACTION_PROMPT } from "./proforma-import-schema";

export function BatchImportStep1Prompt() {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PROFORMA_EXTRACTION_PROMPT);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser may have blocked it.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Get JSON from proforma</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Copy the prompt below, open Claude or Gemini in another tab, paste the
          prompt, and attach your proforma PDF. Copy the JSON from the response
          and bring it back here.
        </p>
      </div>

      <div className="relative">
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {PROFORMA_EXTRACTION_PROMPT}
        </pre>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="absolute right-2 top-2"
        >
          {copied ? (
            <>
              <Check className="mr-1 size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 size-3.5" /> Copy
            </>
          )}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground",
        )}
      >
        {showHelp ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Not sure how to use this? {showHelp ? "Hide steps" : "Show steps"}
      </button>

      {showHelp ? (
        <ol className="ml-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Copy the prompt above.</li>
          <li>
            Open{" "}
            <span className="rounded bg-muted px-1 py-0.5 font-mono">
              claude.ai
            </span>{" "}
            or{" "}
            <span className="rounded bg-muted px-1 py-0.5 font-mono">
              gemini.google.com
            </span>{" "}
            in a new tab.
          </li>
          <li>Paste the prompt, attach your proforma PDF.</li>
          <li>Copy the JSON from the response.</li>
          <li>Come back here, click Next.</li>
        </ol>
      ) : null}
    </div>
  );
}
