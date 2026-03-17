import { sanitizeRichText, richTextToPlainText } from '../../utils/richText';

export default function RichTextContent({ value, className = '', fallback = '' }) {
  const safeHtml = sanitizeRichText(value || '');
  const hasContent = richTextToPlainText(safeHtml).length > 0;

  if (!hasContent) {
    return <span>{fallback}</span>;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
