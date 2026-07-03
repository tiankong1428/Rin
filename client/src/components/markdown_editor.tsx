import { useRef, useState, useLayoutEffect, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";
import { FlatInset } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, uploadImageFile } from "../utils/image-upload";
import Vditor from "vditor";
import "vditor/dist/index.css";

interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
  onRestoreServer?: () => void;
}

/** 根据文件类型生成对应的 Markdown 或 HTML 片段 */
function getFileMarkdown(file: File, url: string, extra?: any): string {
  const type = file.type;
  const name = file.name;
  if (type.startsWith("image/")) {
    return buildMarkdownImage(name, url, {
      blurhash: extra?.blurhash,
      width: extra?.width,
      height: extra?.height,
    });
  } else if (type.startsWith("video/")) {
    return `<video src="${url}" controls style="max-width:100%"></video>`;
  } else if (type.startsWith("audio/")) {
    return `<audio src="${url}" controls></audio>`;
  } else {
    return `[${name}](${url})`;
  }
}

export function MarkdownEditor({
  content,
  setContent,
  placeholder = "> Write your content here...",
  height = "400px",
  onRestoreServer,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const vditorRef = useRef<Vditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  const cleanupRef = useRef<(() => void) | null>(null);
  const vditorReadyRef = useRef(false);

  // 清空内容（带确认）
  const handleClear = () => {
    if (!vditorReadyRef.current) return;
    if (window.confirm(t("confirmClear", "确认清空编辑器内容吗？"))) {
      vditorRef.current?.setValue("");
      setContent("");
    }
  };

  // 初始化 Vditor
  useLayoutEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
      try {
        const vditor = new Vditor(container, {
          height: parseInt(height),
          mode: "ir",
          placeholder,
          theme: colorMode === "dark" ? "dark" : "classic",
          toolbar: [
            "headings", "bold", "italic", "strike", "link", "|",
            "list", "ordered-list", "check", "outdent", "indent", "|",
            "quote", "line", "code", "inline-code", "insert-before", "insert-after", "|",
            "upload", "table", "|",
            "undo", "redo", "|",
            "fullscreen", "edit-mode", "both", "preview", "outline", "code-theme", "export",
          ],
          outline: { enable: false, position: "left" },
          counter: { enable: false },
          cache: { enable: false },
          upload: {
            // 自定义上传处理：支持图片、视频、音频、其他文件
            handler: async (files: File[]) => {
              setUploading(true);
              try {
                for (const file of files) {
                  try {
                    // 调用原上传函数，假设它能处理所有文件类型并返回 URL
                    const result = await uploadImageFile(file);
                    const markdown = getFileMarkdown(file, result.url, {
                      blurhash: (result as any).blurhash,
                      width: (result as any).width,
                      height: (result as any).height,
                    });
                    vditorRef.current?.insertValue(markdown);
                  } catch (err) {
                    console.error(err);
                    showAlert(err instanceof Error ? err.message : t("upload.failed"));
                  }
                }
              } finally {
                setUploading(false);
              }
              return ""; // 阻止 Vditor 默认插入
            },
          },
          input: (value) => {
            if (!isComposingRef.current) setContent(value);
          },
          after: () => {
            vditorReadyRef.current = true;
            if (content && vditor) {
              try {
                vditor.setValue(content);
              } catch (e) {
                console.warn("Vditor setValue failed:", e);
              }
            }
          },
          lang: "zh_CN",
        });

        vditorRef.current = vditor;

        // 中文输入法处理
        const editorEl = container.querySelector(".vditor-ir");
        if (editorEl) {
          const onCompositionStart = () => { isComposingRef.current = true; };
          const onCompositionEnd = () => {
            isComposingRef.current = false;
            if (vditorRef.current) setContent(vditorRef.current.getValue());
          };
          editorEl.addEventListener("compositionstart", onCompositionStart);
          editorEl.addEventListener("compositionend", onCompositionEnd);

          cleanupRef.current = () => {
            editorEl.removeEventListener("compositionstart", onCompositionStart);
            editorEl.removeEventListener("compositionend", onCompositionEnd);
            vditor.destroy();
            vditorRef.current = null;
            vditorReadyRef.current = false;
          };
        }
      } catch (err) {
        console.error("Vditor initialization failed:", err);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []); // 仅挂载一次

  // 外部 content 同步
  useEffect(() => {
    if (!vditorReadyRef.current) return;
    const vditor = vditorRef.current;
    if (!vditor) return;
    if (vditor.getValue() !== content) {
      vditor.setValue(content);
    }
  }, [content]);

  // 主题切换
  useEffect(() => {
    if (!vditorReadyRef.current) return;
    vditorRef.current?.setTheme(colorMode === "dark" ? "dark" : "classic");
  }, [colorMode]);

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      {/* 顶部操作栏：复原 + 清空 + 上传状态 */}
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
        <div className="flex-grow" />
        {onRestoreServer && (
          <button
            onClick={onRestoreServer}
            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-theme px-2 py-1 text-sm text-white transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
          >
            <span>复原</span>
          </button>
        )}
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-w px-2 py-1 text-sm t-primary transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
        >
          <i className="ri-eraser-line" />
          <span>{t("clear")}</span>
        </button>
        {uploading && (
          <div className="flex flex-row items-center space-x-2">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t("uploading")}</span>
          </div>
        )}
      </FlatInset>

      {/* 编辑器全宽 */}
      <div
        className="relative min-h-[420px] min-w-0 overflow-hidden rounded-none border-0 bg-w"
        style={{ height }}
      >
        <div ref={editorContainerRef} className="vditor-container" style={{ height: "100%" }} />
      </div>

      <AlertUI />
    </div>
  );
}