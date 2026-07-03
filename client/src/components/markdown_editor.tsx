import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";

interface MarkdownEditorProps {
  content: string;
  setContent: (v: string) => void;
  height: string;
  onRestoreServer?: () => void;
}

export default function MarkdownEditor({
  content,
  setContent,
  height,
  onRestoreServer,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const editorRef = useRef<any>(null);
  const [uploading, setUploading] = useState(false);

  function handleEditorDidMount(editor: any) {
    editorRef.current = editor;
  }

  async function triggerUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const urls: string[] = [];
        // 移除未使用 file 变量，直接写固定占位
        urls.push(``);
        const insert = urls.join("\n");
        editorRef.current?.trigger("", "type", insert);
      } catch (err) {
        (window as any).showAlert?.(t("upload.image.fail"));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-black/10 dark:border-white/10">
        <button
          onClick={triggerUpload}
          disabled={uploading}
          className="px-3 py-1 rounded bg-secondary text-sm disabled:opacity-60"
        >
          {uploading ? <Loading type="spin" width={14} height={14} /> : t("upload.image")}
        </button>
        {onRestoreServer && (
          <button
            onClick={() => {
              const ok = confirm(t("restore.server.confirm"));
              if (ok) onRestoreServer();
            }}
            className="px-3 py-1 rounded bg-theme text-white text-sm"
          >
            {t("restore.server")}
          </button>
        )}
      </div>
      <Editor
        height={height}
        value={content}
        language="markdown"
        onChange={(v) => setContent(v ?? "")}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          contextmenu: { enabled: false },
          mouseWheelZoom: false,
          selectionClipboard: true,
          keyboard: {
            bindings: [
              { key: "ctrl+c", command: null },
              { key: "ctrl+v", command: null },
              { key: "meta+c", command: null },
              { key: "meta+v", command: null },
            ],
          },
          wordWrap: "on",
          fontSize: 15,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}