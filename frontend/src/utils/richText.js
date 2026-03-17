import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'span', 'div'
];

const ALLOWED_ATTR = ['style'];

export function sanitizeRichText(html) {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function richTextToPlainText(html) {
  if (typeof html !== 'string' || !html.trim()) return '';

  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const temp = document.createElement('div');
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || '').replace(/\u00a0/g, ' ').trim();
}

export function hasMeaningfulRichText(html) {
  return richTextToPlainText(html).length > 0;
}
