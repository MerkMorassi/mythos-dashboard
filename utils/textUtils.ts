
export const markdownToPlainText = (markdown: string): string => {
  if (!markdown) return '';
  let text = markdown;
  // Remove code blocks but keep content
  text = text.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1');
  // Remove headers
  text = text.replace(/^#{1,6}\s/gm, '');
  // Remove links, keeping the link text
  text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  // Remove images, keeping the alt text
  text = text.replace(/!\[(.*?)\]\(.*?\)/g, '$1');
  // Remove bold and italic markers but keep content
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  // Remove inline code backticks
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove blockquotes
  text = text.replace(/^\s*>\s?/gm, '');
  // Remove horizontal rules
  text = text.replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '');
  // Tidy up lists, but keep the content
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  // Remove all leading whitespace (indentation) from each line
  text = text.replace(/^\s+/gm, '');

  return text.trim();
};