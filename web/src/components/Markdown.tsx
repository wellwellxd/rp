import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// 對話／日記內容以 Markdown 呈現。
// remark-breaks：單一換行也視為換行（聊天語境更自然）。
// react-markdown 預設不渲染原始 HTML，避免 XSS。
// 慣例：*星號* → 斜體，用來表示動作 / 情境敘述。
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{children}</ReactMarkdown>
    </div>
  );
}
