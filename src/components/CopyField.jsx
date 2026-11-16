import { useState } from "react";

// A read-only value with a copy button, for keys and secrets.
export default function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the text is selectable anyway.
    }
  };

  return (
    <div className="copy-field">
      <code aria-label={label}>{value}</code>
      <button type="button" className="button button-small" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
