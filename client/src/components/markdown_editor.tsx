import { useRef, useState, useLayoutEffect, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";
import { FlatInset, Input } from "@rin/ui";
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

type UploadDialogMode = "local" | "link";

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
  const isComposingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const { showAlert, AlertUI, showModal, closeModal } = useAlert();

  const cleanupRef = useRef<(() => void) | null>(null);
  const vditorReadyRef = useRef(false);

  // 弹窗状态
  const [dialogMode, setDialogMode] = useState<UploadDialogMode>("local");
  const [inputFileUrl, setInputFileUrl] = useState("");
  const [inputFileName, setInputFileName] = useState("");

  // 清空编辑器
  const handleClear = () => {
    if (!vditorReadyRef.current) return;
    if (window.confirm(t("confirmClear", "确认清空编辑器内容吗？"))) {
      vditorRef.current?.setValue("");
      setContent("");
    }
  };

  // 插入外部链接文件
  const insertExternalFileLink = () => {
    if (!inputFileUrl.trim()) return showAlert(t("upload.link.emptyUrl"));
    if (!inputFileName.trim()) return showAlert(t("upload.link.emptyName"));
    const mime = guessMimeByFileName(inputFileName);
    const md = getFileMarkdown(inputFileName, inputFileUrl, mime);
    vditorRef.current?.insertValue(md);
    // 清空输入框
    setInputFileUrl("");
    setInputFileName("");
    closeModal();
  };

  // 打开上传选择弹窗
  const openUploadSelectDialog = () => {
    setDialogMode("local");
    setInputFileUrl("");
    setInputFileName("");
    showModal({
      title: t("upload.selectMode"),
      width: 520,
      content: (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-200">
            {t("upload.largeFileTip")}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDialogMode("local")}
              className={`flex-1 py-2 rounded-lg border ${dialogMode === "local" ? "border-theme bg-theme/10" : "border-neutral-200 dark:border-neutral-700"}`}
            >
              {t("upload.localFile")}
            </button>
            <button
              onClick={() => setDialogMode("link")}
              className={`flex-1 py-2 rounded-lg border ${dialogMode === "link" ? "border-theme bg-theme/10" : "border-neutral-200 dark:border-neutral-700"}`}
            >
              {t("upload.inputLink")}
            </button>
          </div>

          {dialogMode === "link" ? (
            <div className="space-y-3">
              <Input
                value={inputFileName}
                setValue={setInputFileName}
                placeholder={t("upload.link.fileNamePlaceholder")}
                variant="flat"
              />
              <Input
                value={inputFileUrl}
                setValue={setInputFileUrl}
                placeholder={t("upload.link.urlPlaceholder")}
                variant="flat"
              />
              <button
                onClick={insertExternalFileLink}
                className="w-full rounded-lg bg-theme text-white py-2"
              >
                {t("confirm")}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-neutral-500 mb-3">{t("upload.localTip")}</p>
              <input
                ref={(el) => {
                  if (el) {
                    el.onchange = async (e) => {
                      const files = Array.from(e.target.files || []);
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
                        closeModal();
                        el.value = "";
                      }
                    };
                  }
                }}
                type="file"
                multiple
                className="block w-full"
              />
            </div>
          )}
        </div>
      ),
      footer: null,
    });
  };

  // 初始化 Vditor（已添加 parse.html: true 修复 <br> 不换行）
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
          // 核心配置：开启HTML解析，<br>正常渲染换行
          parse: {
            html: true,
          },
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
  }, []);

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
        {/* 自定义上传按钮，打开选择弹窗 */}
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
      </div>
      <AlertUI />
    </div>
  );
}