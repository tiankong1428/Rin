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

// 根据文件名后缀推测MIME
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

// 将 <br> / <br/> 替换为markdown硬换行
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

  // 清空编辑器
  const handleClear = () => {
    if (!vditorReadyRef.current) return;
    if (window.confirm(t("confirmClear"))) {
      vditorRef.current?.setValue("");
      setContent("");
    }
  };

  // 统一上传文件处理
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

  // 打开本地文件选择
  const openLocalUpload = () => {
    fileInputRef.current?.click();
  };

  // 外部链接输入
  const openLinkUpload = () => {
    const name = window.prompt(t("upload.link.fileNamePlaceholder"));
    if (!name?.trim()) return showAlert(t("upload.link.emptyName"));
    const url = window.prompt(t("upload.link.urlPlaceholder"));
    if (!url?.trim()) return showAlert(t("upload.link.emptyUrl"));
    const mime = guessMimeByFileName(name);
    const md = getFileMarkdown(name, url, mime);
    vditorRef.current?.insertValue(md);
  };

  // 上传弹窗选择
  const openUploadSelectDialog = () => {
    const mode = window.confirm(`${t("upload.largeFileTip")}\n\n${t("upload.localFile")} → 确定\n${t("upload.inputLink")} → 取消`);
    if (mode) openLocalUpload();
    else openLinkUpload();
  };

  // 初始化 Vditor（移除所有不存在的html解析配置，无多余字段）
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
          input: (rawValue) => {
            if (isComposingRef.current) return;
            // 自动把所有 <br> 转为标准markdown换行，解决不生效问题
            const fixed = replaceBrToLineBreak(rawValue);
            if (fixed !== rawValue) {
              vditorRef.current?.setValue(fixed);
            }
            setContent(fixed);
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
              setContent(replaceBrToLineBreak(val));
            }
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
  }, []);

  // 外部传入content同步到编辑器
  useEffect(() => {
    if (!vditorReadyRef.current) return;
    const vditor = vditorRef.current;
    if (!vditor) return;
    const currentVal = vditor.getValue();
    const fixedInputContent = replaceBrToLineBreak(content);
    if (currentVal !== fixedInputContent) {
      vditor.setValue(fixedInputContent);
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
        <button
          onClick={openUploadSelectDialog}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-w px-2 py-1 text-sm t-primary transition-colors hover:border-black/20 disabled:opacity-60 dark:border-white/10 dark:hover:border-white/20"
        >
          <i className="ri-upload-2-line" />
          <span>{t("upload.title")}</span>
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