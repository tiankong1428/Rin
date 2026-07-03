import React, { useRef, useState, useEffect } from "react";
import Vditor from "vditor";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";
import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, uploadImageFile } from "../utils/image-upload";
import { Markdown } from "./markdown";

interface VditorEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
  onRestoreServer?: () => void;
}

export function VditorEditor({
  content,
  setContent,
  placeholder = "> Write your content here...",
  height = "400px",
  onRestoreServer,
}: VditorEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const isDark = colorMode === "dark";
  const vditorDomRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const [uploading, setUploading] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  const uploadFile = async (files: File[]) => {
    setUploading(true);
    const insertTexts: string[] = [];
    try {
      for (const file of files) {
        const res = await uploadImageFile(file, {} as any, showAlert);
        const imgMd = buildMarkdownImage(file.name, res.url, {
          blurhash: res.blurhash,
          width: res.width,
          height: res.height,
        });
        insertTexts.push(imgMd);
      }
      vditorRef.current?.insertValue(insertTexts.join("\n"));
    } catch (err) {
      showAlert(t("upload.failed"));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!vditorDomRef.current || vditorRef.current) return;

    const vditor = new Vditor(vditorDomRef.current!, {
      height,
      placeholder,
      mode: "sv",
      theme: isDark ? "dark" : "light",
      preview: {
        theme: { current: isDark ? "dark" : "light" },
      },
      cache: false,
      value: content,
      input: (val) => setContent(val),
      upload: {
        accept: "image/*",
        multiple: true,
        handler: async (files) => {
          await uploadFile(files);
          return false;
        },
      },
      toolbar: [
        "emoji",
        "headings",
        "bold",
        "italic",
        "strike",
        "link",
        "|",
        "list",
        "ordered-list",
        "check",
        "table",
        "code",
        "code-block",
        "|",
        "undo",
        "redo",
        "fullscreen",
      ],
      toolbarConfig: {
        pin: true,
      },
    });

    vditorRef.current = vditor;

    return () => {
      vditor.destroy();
      vditorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!vditorRef.current) return;
    if (vditorRef.current.getValue() !== content) {
      vditorRef.current.setValue(content);
    }
  }, [content]);

  const handleRestore = () => {
    if (!vditorRef.current || !onRestoreServer) return;
    onRestoreServer();
  };

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
        <FlatTabButton active onClick={() => vditorRef.current?.setMode("sv")}>
          {t("comparison")}
        </FlatTabButton>
        <div className="flex-grow" />
        {onRestoreServer && (
          <button
            onClick={handleRestore}
            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-theme px-2 py-1 text-sm text-white transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
          >
            <span>复原</span>
          </button>
        )}
        {uploading && (
          <div className="flex flex-row items-center space-x-2">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t("uploading")}</span>
          </div>
        )}
      </FlatInset>
      <div ref={vditorDomRef} />
      <AlertUI />
    </div>
  );
}