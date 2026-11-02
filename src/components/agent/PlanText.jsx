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

/** Renders the agent's Markdown as clean headings, lists and tables. */
export default function PlanText({ text, streaming }) {
  return (
    <div className={`md ${streaming ? 'is-streaming' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {tidy(text)}
      </ReactMarkdown>
    </div>
  );
}

// Removes stray symbols some models add (hashtags, code fences, lone dashes).
function tidy(t) {
  return t
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/(^|\s)#[A-Za-z][\w]*(?=\s|$)/g, '$1')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '');
}
