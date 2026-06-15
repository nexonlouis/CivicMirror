import { Fragment } from "react";

const URL_REGEX =
  /\b(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi;

type TextPart = { type: "text"; value: string };
type UrlPart = { type: "url"; href: string; label: string };
type Part = TextPart | UrlPart;

function trimUrlPunctuation(url: string): { core: string; trailing: string } {
  let core = url;
  let trailing = "";
  while (/[.,;:!?)}\]'"]$/.test(core)) {
    trailing = core.slice(-1) + trailing;
    core = core.slice(0, -1);
  }
  return { core, trailing };
}

function toHref(url: string): string {
  return url.startsWith("www.") ? `https://${url}` : url;
}

export function linkifyText(text: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    const { core, trailing } = trimUrlPunctuation(raw);
    if (core) {
      parts.push({ type: "url", href: toHref(core), label: core });
    } else {
      parts.push({ type: "text", value: raw });
    }
    if (trailing) {
      parts.push({ type: "text", value: trailing });
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts = linkifyText(text);

  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (part.type === "url") {
          return (
            <a
              key={index}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {part.label}
            </a>
          );
        }
        return <Fragment key={index}>{part.value}</Fragment>;
      })}
    </p>
  );
}
