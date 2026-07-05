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
function getFileMarkdown(fileName: string, url: string, mimeType?: string, extra?: any): string {
  const type = mimeType || "";
  const name = fileName;
  const lineBreak = "  \n";
  if (type.startsWith("image/")) {
    return buildMarkdownImage(name, url, {
      blurhash: extra?.blurhash,
      width: extra?.width,
      height: extra?.height,
    }) + lineBreak;
  } else if (type.startsWith("video/")) {
    return `<video src="${url}" controls style="max-width:100%"></video>` + lineBreak;
  } else if (type.startsWith("audio/")) {
    return `<audio src="${url}" controls>` + lineBreak;
  } else {
    return `[${name}](${url})` + lineBreak;
  }
}

const guessMimeByFileName = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const imgExt = ["png", "jpg", "jpeg", "gif", "webp"];
  const videoExt = ["mp4", "mov", "webm"];
  const audioExt = ["mp3", "wav", "flac"];
  if (imgExt.includes(ext || "")) return `image/${ext}`;
  if (videoExt.includes(ext || "")) return `video/${ext}`;
  if (audioExt.includes(ext || "")) return `audio/${ext}`;
  return "application/octet-stream";
};

const replaceBrToLineBreak = (text: string): string => {
  return text.replace(/<br\s*\/?>/gi, "  \n");
};

export function MarkdownEditor({
  content,
  setContent,
  placeholder = "> 在这里输入内容...",
  height = "400px",
  onRestoreServer,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const vditorRef = useRef<Vditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  const cleanupRef = useRef<(() => void) | null>(null);
  const vditorReadyRef = useRef(false);

  const handleClear = () => {
    if (!vditorReadyRef.current) return;
    if (window.confirm(t("confirmClear"))) {
      vditorRef.current?.setValue("");
      setContent("");
    }
  };

  // 处理文件上传（本地）
  const handleUploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const result = await uploadImageFile(file);
        const markdown = getFileMarkdown(file.name, result.url, file.type, {
          blurhash: (result as any).blurhash,
          width: (result as any).width,
          height: (result as any).height,
        });
        vditorRef.current?.insertValue(markdown);
      }
    } catch (err) {
      console.error(err);
      showAlert(err instanceof Error ? err.message : t("upload.failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 本地上传：打开文件选择
  const openLocalUpload = () => {
    fileInputRef.current?.click();
  };

  // 链接上传：通过 URL 和自定义文件名插入
  const openLinkUpload = () => {
    const name = window.prompt(t("upload.link.fileNamePlaceholder"));
    if (name === null) return; // 用户取消，静默退出
    if (!name.trim()) return showAlert(t("upload.link.emptyName"));

    const url = window.prompt(t("upload.link.urlPlaceholder"));
    if (url === null) return;
    if (!url.trim()) return showAlert(t("upload.link.emptyUrl"));

    const mime = guessMimeByFileName(name);
    const md = getFileMarkdown(name, url, mime);
    vditorRef.current?.insertValue(md);
  };

  // 初始化 Vditor
  useLayoutEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
      try {
        const vditor = new Vditor(container, {
          cdn: "/assets/vditor",
          lang: "zh_CN",
          height: parseInt(height),
          mode: "ir",
          placeholder,
          theme: colorMode === "dark" ? "dark" : "classic",
          toolbar: [
            "headings", "bold", "italic", "strike", "link", "|",
            "list", "ordered-list", "check", "outdent", "indent", "|",
            "quote", "line", "code", "inline-code", "insert-before", "insert-after", "|",
            "table", "|",
            "undo", "redo", "|",
            "fullscreen", "edit-mode", "both", "preview", "outline", "code-theme", "export",
          ],
          outline: { enable: false, position: "left" },
          counter: { enable: false },
          cache: { enable: false },
          upload: { handler: () => "" },

          // 开启 HTML 渲染，让 <br> 等标签能被即时渲染
          html: true,
          render: {
            html: true,
          },

          input: (rawValue) => {
            if (isComposingRef.current) return;
            // 直接同步内容，不再做全局 <br> 替换以避免光标跳动
            setContent(rawValue);
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

            // 绑定粘贴事件：处理粘贴内容中的 <br>
            const editorEl = container.querySelector(".vditor-ir");
            if (editorEl) {
              const pasteHandler = (e: ClipboardEvent) => {
                const text = e.clipboardData?.getData("text/plain");
                if (text && /<br\s*\/?>/i.test(text)) {
                  e.preventDefault();
                  const fixed = replaceBrToLineBreak(text);
                  vditor.insertValue(fixed);
                }
                // 否则保持默认粘贴行为
              };
              editorEl.addEventListener("paste", pasteHandler);

              // 记录清理函数
              cleanupRef.current = () => {
                editorEl.removeEventListener("paste", pasteHandler);
                vditor.destroy();
                vditorRef.current = null;
                vditorReadyRef.current = false;
              };
            }
          },
        });

        vditorRef.current = vditor;

        // 中文输入法组合文字处理
        const editorEl = container.querySelector(".vditor-ir");
        if (editorEl) {
          const onCompositionStart = () => { isComposingRef.current = true; };
          const onCompositionEnd = () => {
            isComposingRef.current = false;
            if (vditorRef.current) {
              const val = vditorRef.current.getValue();
              setContent(val);
            }
          };
          editorEl.addEventListener("compositionstart", onCompositionStart);
          editorEl.addEventListener("compositionend", onCompositionEnd);

          // 合并清理函数
          const prevCleanup = cleanupRef.current;
          cleanupRef.current = () => {
            editorEl.removeEventListener("compositionstart", onCompositionStart);
            editorEl.removeEventListener("compositionend", onCompositionEnd);
            prevCleanup?.();
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
  }, []);

  // 外部传入 content 同步到编辑器
  useEffect(() => {
    if (!vditorReadyRef.current) return;
    const vditor = vditorRef.current;
    if (!vditor) return;
    const currentVal = vditor.getValue();
    if (currentVal !== content) {
      vditor.setValue(content);
    }
  }, [content]);

  // 暗黑/浅色主题切换
  useEffect(() => {
    if (!vditorReadyRef.current) return;
    vditorRef.current?.setTheme(colorMode === "dark" ? "dark" : "classic");
  }, [colorMode]);

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
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
        {/* 拆分为两个独立的上传按钮 */}
        <button
          onClick={openLocalUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-w px-2 py-1 text-sm t-primary transition-colors hover:border-black/20 disabled:opacity-60 dark:border-white/10 dark:hover:border-white/20"
        >
          <i className="ri-upload-2-line" />
          <span>{t("upload.local") || "本地上传"}</span>
        </button>
        <button
          onClick={openLinkUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-w px-2 py-1 text-sm t-primary transition-colors hover:border-black/20 disabled:opacity-60 dark:border-white/10 dark:hover:border-white/20"
        >
          <i className="ri-link" />
          <span>{t("upload.link") || "链接上传"}</span>
        </button>
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
      <div
        className="relative min-h-[420px] min-w-0 overflow-hidden rounded-none border-0 bg-w"
        style={{ height }}
      >
        <div ref={editorContainerRef} className="vditor-container" style={{ height: "100%" }} />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            const files = target.files;
            if (!files) return;
            const fileList = Array.from(files) as File[];
            void handleUploadFiles(fileList);
          }}
        />
      </div>
      <AlertUI />
    </div>
  );
}