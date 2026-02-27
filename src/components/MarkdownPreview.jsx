import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import styles from './MarkdownPreview.module.css';

marked.setOptions({ breaks: true, gfm: true });

export default function MarkdownPreview({ content, isDark }) {
  const html = useMemo(() => {
    if (!content) return '<p style="color:var(--text-muted);font-style:italic">Nothing to preview yet…</p>';
    const raw = marked.parse(content);
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div className={`${styles.preview} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.inner} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
