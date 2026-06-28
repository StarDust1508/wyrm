/* Shared chapter-HTML sanitizer (editor output + imported .docx/.txt).
   Strict allowlist: kills <script>, event handlers, javascript: URLs, styles —
   anything that could become stored XSS once a chapter is shown to readers.
   The PocketBase server hook (wyrm_lib.js sanitizeHtml) re-sanitizes on save as
   defense-in-depth; this is the client guard and must allow the same tag set
   the Tiptap editor can produce (headings, links, scene breaks, lists…). */
import DOMPurify from 'dompurify';

export const SAFE_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li',
  'a', 'hr', 'code', 'pre',
];

export function cleanHtml(html) {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: ['href', 'rel', 'target'],
    // hardening: only http(s)/mailto/relative/anchor hrefs survive
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
