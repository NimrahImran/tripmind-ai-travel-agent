import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  // Wide tables scroll sideways on phones instead of breaking the layout.
  table: ({ node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  // The model is told not to use these, but if it slips they render quietly.
  hr: () => null,
  h1: ({ node, ...props }) => <h2 {...props} />,
};

/**
 * Renders the agent's Markdown as clean headings, lists and tables, typing it
 * out smoothly even when the model sends text in large chunks.
 */
export default function PlanText({ text, streaming }) {
  const shown = useTypewriter(text, streaming);
  const typing = streaming || shown < text.length;
  return (
    <div className={`md ${typing ? 'is-streaming' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {tidy(text.slice(0, shown))}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Reveals text a few characters per frame. Speeds up when it falls behind,
 * so a big chunk still reads as typing but never lags more than ~1–2 s.
 */
function useTypewriter(text, streaming) {
  // A saved or already-finished plan shows at once.
  const [shown, setShown] = useState(() => (streaming ? 0 : text.length));
  const target = useRef(text.length);
  target.current = text.length;

  useEffect(() => {
    if (shown >= text.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(text.length);
      return;
    }
    let raf = requestAnimationFrame(function tick() {
      setShown((s) => {
        const behind = target.current - s;
        if (behind <= 0) return s;
        return Math.min(target.current, s + Math.max(2, Math.ceil(behind / 28)));
      });
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [text.length, shown >= text.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the text is replaced by something shorter (a new plan), start over.
  useEffect(() => {
    if (shown > text.length) setShown(0);
  }, [text, shown]);

  return Math.min(shown, text.length);
}

// Removes stray symbols some models add (hashtags, code fences, lone dashes).
function tidy(t) {
  return t
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/(^|\s)#[A-Za-z][\w]*(?=\s|$)/g, '$1')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '');
}
