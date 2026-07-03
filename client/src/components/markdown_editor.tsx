import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, uploadImageFile } from "../utils/image-upload";
import { Markdown } from "./markdown";
import Vditor from "vditor";
// CSS 已从 HTML 全局引入，此处不再 import

interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
  onRestoreServer?: () => void;
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
  const [preview, setPreview] = useState<'edit' | 'preview' | 'comparison'>('edit');
  const [uploading, setUploading] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  // 初始化 Vditor（只执行一次）
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const vditor = new Vditor(editorContainerRef.current, {
      height: parseInt(height),
      mode: "ir",                        // 即时渲染
      placeholder,
      theme: colorMode === "dark" ? "dark" : "classic",
      // 工具栏：留空表示使用全部默认按钮，也可以传入数组自定义
      toolbar: [
        "headings",
        "bold",
        "italic",
        "strike",
        "link",
        "|",
        "list",
        "ordered-list",
        "check",
        "outdent",
        "indent",
        "|",
        "quote",
        "line",
        "code",
        "inline-code",
        "insert-before",
        "insert-after",
        "|",
        "upload",           // 保留图片上传按钮，后面通过 upload 配置接管
        "table",
        "|",
        "undo",
        "redo",
        "|",
        "fullscreen",
        "edit-mode",
        "both",
        "preview",
        "outline",
        "code-theme",
        "export",
      ],
      outline: false,
      counter: { enable: false },
      cache: { enable: false },

      // 自定义图片上传逻辑（接管工具栏、粘贴、拖拽）
      upload: {
        // 限制文件大小（可选）
        max: 5 * 1024 * 1024, // 5MB
        handler: async (files: File[]) => {
          setUploading(true);
          try {
            for (const file of files) {
              try {
                const result = await uploadImageFile(file);
                // 生成自定义 Markdown 图片语法（可含宽高、blurhash 等）
                const imgMarkdown = buildMarkdownImage(file.name, result.url, {
                  blurhash: result.blurhash,
                  width: result.width,
                  height: result.height,
                });
                // 手动插入，避免 Vditor 默认生成
                vditorRef.current?.insertValue(imgMarkdown);
              } catch (err) {
                console.error(err);
                showAlert(err instanceof Error ? err.message : t("upload.failed"));
                // 某一张失败不影响其他
              }
            }
          } finally {
            setUploading(false);
          }
          // 返回空字符串，阻止 Vditor 再次插入
          return "";
        },
      },

      // 内容变化回调
      input: (value) => {
        if (!isComposingRef.current) {
          setContent(value);
        }
      },
      after: () => {
        if (content) {
          vditor.setValue(content);
        }
      },
      lang: "zh_CN",
    });

    vditorRef.current = vditor;

    // 处理中文输入法（监听 composition 事件）
    const editorEl = editorContainerRef.current.querySelector(".vditor-ir");
    if (editorEl) {
      const onCompositionStart = () => {
        isComposingRef.current = true;
      };
      const onCompositionEnd = () => {
        isComposingRef.current = false;
        if (vditorRef.current) {
          setContent(vditorRef.current.getValue());
        }
      };
      editorEl.addEventListener("compositionstart", onCompositionStart);
      editorEl.addEventListener("compositionend", onCompositionEnd);

      return () => {
        editorEl.removeEventListener("compositionstart", onCompositionStart);
        editorEl.removeEventListener("compositionend", onCompositionEnd);
        vditor.destroy();
        vditorRef.current = null;
      };
    }

    return () => {
      vditor.destroy();
      vditorRef.current = null;
    };
  }, []); // 只挂载一次

  // 外部 content 变化时同步到编辑器
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor) return;
    if (vditor.getValue() !== content) {
      vditor.setValue(content);
    }
  }, [content]);

  // 主题跟随 colorMode 切换
  useEffect(() => {
    vditorRef.current?.setTheme(colorMode === "dark" ? "dark" : "classic");
  }, [colorMode]);

  // 顶部工具栏右侧的复原按钮保留
  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      {/* 视图切换 + 复原按钮 */}
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
        <FlatTabButton active={preview === 'edit'} onClick={() => setPreview('edit')}>
          {t("edit")}
        </FlatTabButton>
        <FlatTabButton active={preview === 'preview'} onClick={() => setPreview('preview')}>
          {t("preview")}
        </FlatTabButton>
        <FlatTabButton active={preview === 'comparison'} onClick={() => setPreview('comparison')}>
          {t("comparison")}
        </FlatTabButton>
        <div className="flex-grow" />
        {onRestoreServer && (
          <button
            onClick={onRestoreServer}
            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-theme px-2 py-1 text-sm text-white transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
          >
            <span>复原</span>
          </button>
        )}
        {uploading && (
          <div className="flex flex-row items-center space-x-2">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t('uploading')}</span>
          </div>
        )}
      </FlatInset>

      <div
        className={`grid grid-cols-1 gap-0 sm:gap-4 ${
          preview === 'comparison' ? "lg:grid-cols-2" : ""
        }`}
      >
        {/* 编辑区 */}
        <div className={"flex min-w-0 flex-col " + (preview === 'preview' ? "hidden" : "")}>
          <div
            className="relative min-h-[420px] min-w-0 overflow-hidden rounded-none border-0 bg-w"
            style={{ height }}
          >
            <div
              ref={editorContainerRef}
              className="vditor-container"
              style={{ height: "100%" }}
            />
          </div>
        </div>

        {/* 纯预览区（你的 Markdown 渲染组件） */}
        <div
          className={
            "min-h-0 overflow-y-auto rounded-none border-0 bg-w px-4 py-4 border-t sm:border-none " +
            (preview === 'edit' ? "hidden" : "")
          }
          style={{ height }}
        >
          <Markdown content={content ? content : placeholder} />
        </div>
      </div>
      <AlertUI />
    </div>
  );
}