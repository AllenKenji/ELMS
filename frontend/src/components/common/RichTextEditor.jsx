import { useEffect, useMemo, useRef } from 'react';
import { sanitizeRichText } from '../../utils/richText';
import '../../styles/RichTextEditor.css';

const TOOLBAR_ACTIONS = [
  { command: 'bold', label: 'B', title: 'Bold' },
  { command: 'italic', label: 'I', title: 'Italic' },
  { command: 'underline', label: 'U', title: 'Underline' },
  { command: 'insertUnorderedList', label: 'Bullets', title: 'Bulleted List' },
  { command: 'insertOrderedList', label: 'Numbering', title: 'Numbered List' },
  { command: 'outdent', label: 'Outdent', title: 'Outdent' },
  { command: 'indent', label: 'Indent', title: 'Indent' },
];

function isSelectionInsideList() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  let node = selection.anchorNode;
  while (node) {
    if (node.nodeName === 'LI') return true;
    node = node.parentNode;
  }
  return false;
}

export default function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaInvalid = false,
  ariaDescribedBy,
}) {
  const editorRef = useRef(null);

  const safeValue = useMemo(() => sanitizeRichText(value || ''), [value]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== safeValue) {
      editorRef.current.innerHTML = safeValue;
    }
  }, [safeValue]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const html = sanitizeRichText(editorRef.current.innerHTML);
    onChange?.(html);
  };

  const executeCommand = (command) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    emitChange();
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;

    event.preventDefault();
    if (disabled) return;

    editorRef.current?.focus();

    if (isSelectionInsideList()) {
      document.execCommand(event.shiftKey ? 'outdent' : 'indent', false, null);
    } else {
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }

    emitChange();
  };

  return (
    <div className={`richtext-editor ${disabled ? 'is-disabled' : ''}`}>
      <div className="richtext-toolbar" role="toolbar" aria-label="Agenda formatting tools">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.command}
            type="button"
            className="richtext-tool-btn"
            title={action.title}
            onClick={() => executeCommand(action.command)}
            disabled={disabled}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div
        id={id}
        ref={editorRef}
        className="richtext-input"
        contentEditable={!disabled}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyDown={handleKeyDown}
        role="textbox"
        aria-multiline="true"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}
