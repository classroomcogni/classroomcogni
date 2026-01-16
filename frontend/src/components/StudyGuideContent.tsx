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
      <div className="text-[#5f6368] italic py-4">
        No content available. Try regenerating the study guide.
      </div>
    );
  }
  
  // Normalize LaTeX before rendering
  const normalizedContent = normalizeLatex(content);
  const components: Components = {
    // Headings
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-[#202124] mt-6 mb-4 border-b border-[#dadce0] pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-[#202124] mt-5 mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-[#1a73e8] mt-4 mb-2">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-[#3c4043] mt-3 mb-2">
        {children}
      </h4>
    ),
    
    // Paragraphs
    p: ({ children }) => (
      <p className="text-[#3c4043] mb-3 leading-relaxed">
        {children}
      </p>
    ),
    
    // Lists
    ul: ({ children }) => (
      <ul className="list-disc text-[#3c4043] mb-3 space-y-1 ml-6 pl-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal text-[#3c4043] mb-3 space-y-1 ml-6 pl-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-[#3c4043] pl-1">
        {children}
      </li>
    ),
    
    // Code blocks
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-[#f1f3f4] text-[#d93025] px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className={`${className} block bg-[#f8f9fa] p-4 rounded-lg overflow-x-auto text-sm font-mono text-[#3c4043] border border-[#dadce0]`} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-[#f8f9fa] rounded-lg mb-3 overflow-x-auto border border-[#dadce0]">
        {children}
      </pre>
    ),
    
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[#1a73e8] pl-4 my-3 text-[#5f6368] italic bg-[#f8f9fa] py-2 rounded-r">
        {children}
      </blockquote>
    ),
    
    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-[#dadce0] rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[#f1f3f4]">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-[#dadce0] bg-white">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-[#f8f9fa]">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-[#202124] font-semibold border-b border-[#dadce0]">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-[#3c4043]">
        {children}
      </td>
    ),
    
    // Links
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-[#1a73e8] hover:underline"
      >
        {children}
      </a>
    ),
    
    // Horizontal rule
    hr: () => (
      <hr className="border-[#dadce0] my-4" />
    ),
    
    // Strong and emphasis
    strong: ({ children }) => (
      <strong className="font-bold text-[#202124]">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-[#3c4043]">
        {children}
      </em>
    ),
  };

  return (
    <div className="study-guide-content prose max-w-none">
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
