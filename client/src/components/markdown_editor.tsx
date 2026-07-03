const vditor = new Vditor(container, {
  height: parseInt(height),
  mode: "ir",
  placeholder,
  theme: colorMode === "dark" ? "dark" : "classic",
  // 移除 lang: "zh_CN"
  i18n: {
    undo: "撤销",
    redo: "重做",
    bold: "粗体",
    italic: "斜体",
    strike: "删除线",
    link: "链接",
    upload: "上传",
    table: "表格",
    fullscreen: "全屏",
    preview: "预览",
    both: "分栏",
    editMode: "编辑模式",
    codeTheme: "代码主题",
    export: "导出",
    headings: "标题",
    list: "无序列表",
    orderedList: "有序列表",
    check: "待办",
    indent: "增加缩进",
    outdent: "减少缩进",
    quote: "引用",
    code: "代码块",
    inlineCode: "行内代码",
    line: "分割线",
    image: "图片",
    outline: "大纲",
    confirmClear: "确认清空编辑器内容吗？",
  },
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
    handler: async (files: File[]) => {
      setUploading(true);
      try {
        for (const file of files) {
          try {
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
      return "";
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
  // 删掉 lang: "zh_CN"
});