import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";
import { ShowAlertType } from "./dialog";
import { uploadImage } from "../utils/upload";

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
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor) {
    editorRef.current = editor;
  }

  // 图片上传
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
        for (const file of Array.from(files)) {
          const url = await uploadImage(file);
          urls.push(`![${file.name}](${url})`);
        }
        const text = editorRef.current?.getSelection()?.toString() || "";
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
      {/* 工具栏：上传图片 + 还原服务器版本 */}
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
          // 关闭编辑器自定义右键菜单，手机长按弹出系统原生复制粘贴
          contextmenu: { enabled: false },
          mouseWheelZoom: false,
          selectionClipboard: true,
          // 放行系统原生复制粘贴快捷键 ctrl/cmd + c/v
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