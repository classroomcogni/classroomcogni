'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Components } from 'react-markdown';

interface StudyGuideContentProps {
  content: string;
}

// Normalize LaTeX delimiters to standard $ and $$ format
function normalizeLatex(text: string): string {
  let result = text;
  
  // Convert \[...\] to $$...$$
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  
  // Convert \(...\) to $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  // Fix double-escaped backslashes in LaTeX commands (\\frac -> \frac)
  result = result.replace(/\$([^$]+)\$/g, (match, inner) => {
    return '$' + inner.replace(/\\\\/g, '\\') + '$';
  });
  
  return result;
}

export default function StudyGuideContent({ content }: StudyGuideContentProps) {
  if (!content || content.trim() === '') {
    return (
      <div className="text-gray-400 italic py-4">
        No content available. Try regenerating the study guide.
      </div>
    );
  }
  
  // Normalize LaTeX before rendering
  const normalizedContent = normalizeLatex(content);
  const components: Components = {
    // Headings
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-white mt-6 mb-4 border-b border-[#3f4147] pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-white mt-5 mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-[#e01e5a] mt-4 mb-2">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-gray-200 mt-3 mb-2">
        {children}
      </h4>
    ),
    
    // Paragraphs
    p: ({ children }) => (
      <p className="text-gray-300 mb-3 leading-relaxed">
        {children}
      </p>
    ),
    
    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1 ml-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1 ml-2">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-gray-300">
        {children}
      </li>
    ),
    
    // Code blocks
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-[#1a1d21] text-[#e01e5a] px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className={`${className} block bg-[#1a1d21] p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-300`} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-[#1a1d21] rounded-lg mb-3 overflow-x-auto">
        {children}
      </pre>
    ),
    
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[#e01e5a] pl-4 my-3 text-gray-400 italic">
        {children}
      </blockquote>
    ),
    
    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-[#3f4147] rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[#1a1d21]">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-[#3f4147]">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-[#2a2d31]">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-white font-semibold border-b border-[#3f4147]">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-gray-300">
        {children}
      </td>
    ),
    
    // Links
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-[#1d9bd1] hover:underline"
      >
        {children}
      </a>
    ),
    
    // Horizontal rule
    hr: () => (
      <hr className="border-[#3f4147] my-4" />
    ),
    
    // Strong and emphasis
    strong: ({ children }) => (
      <strong className="font-bold text-white">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-200">
        {children}
      </em>
    ),
  };

  return (
    <div className="study-guide-content prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
