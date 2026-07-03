import i18n from 'i18next';
import _ from 'lodash';
import {useCallback, useContext, useEffect, useState} from "react";
import { ProfileContext } from '../state/profile';
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel } from "@rin/ui";
import { client } from "../app/runtime";
import {Cache} from '../utils/cache';
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants";
import mermaid from 'mermaid';
import { MarkdownEditor } from '../components/markdown_editor';

interface FeedUpdateParams {
  id: number;
  listed: boolean;
  title?: string;
  alias?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  draft?: boolean;
  loginRequired?: boolean;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}

async function publish({
  title,
  alias,
  listed,
  content,
  summary,
  tags,
  draft,
  loginRequired,
  createdAt,
  onCompleted,
  showAlert
}: {
  title: string;
  listed: boolean;
  content: string;
  summary: string;
  tags: string[];
  draft: boolean;
  loginRequired: boolean;
  alias?: string;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const t = i18n.t
  const { data, error } = await client.feed.create(
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      loginRequired,
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error instanceof Error ? error.message : t("upload.failed"));
  }
  if (data) {
    showAlert(t("publish.success"), () => {
      Cache.with().clear();
      window.location.href = "/feed/" + data.insertedId;
    });
  }
}

async function update({
  id,
  title,
  alias,
  content,
  summary,
  tags,
  draft,
  loginRequired,
  createdAt,
  onCompleted,
  showAlert
}: FeedUpdateParams) {
  const t = i18n.t
  const { error } = await client.feed.update(
    id,
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      loginRequired,
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error instanceof Error ? error.message : t("upload.failed"));
  } else {
    showAlert(t("update.success"), () => {
      Cache.with(id).clear();
      window.location.href = "/feed/" + id;
    });
  }
}

// 写作页面
export function WritingPage({ id }: { id?: number }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const cache = Cache.with(id);
  const [title, setTitle] = cache.useCache("title", "");
  const [summary, setSummary] = cache.useCache("summary", "");
  const [tags, setTags] = cache.useCache("tags", "");
  const [alias, setAlias] = cache.useCache("alias", "");
  const [draft, setDraft] = useState(false);
  const [listed, setListed] = useState(true);
  const [loginRequired, setLoginRequired] = useState(false);
  const [content, setContent] = cache.useCache("content", "");
  const [pageError, setPageError] = useState<string | null>(null);
  const [feedData, setFeedData] = useState<any>(null);
  const [createdAt, setCreatedAt] = useState<Date | undefined>(new Date());
  const [publishing, setPublishing] = useState(false)
  const { showAlert, AlertUI } = useAlert();
  const profile = useContext(ProfileContext);
  const isAdmin = profile?.permission ?? false;

  function publishButton() {
    if (publishing) return;
    const tagsplit =
      tags
        .split("#")
        .filter((tag) => tag !== "")
        .map((tag) => tag.trim()) || [];
    if (id !== undefined) {
      setPublishing(true)
      update({
        id,
        title,
        content,
        summary,
        alias,
        tags: tagsplit,
        draft,
        listed,
        loginRequired,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert
      });
    } else {
      if (!title) {
        showAlert(t("title.empty"));
        return;
      }
      if (!content) {
        showAlert(t("content.empty"));
        return;
      }
      setPublishing(true)
      publish({
        title,
        content,
        summary,
        tags: tagsplit,
        draft,
        alias,
        listed,
        loginRequired,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert
      });
    }
  }

  // 登录状态监听
  useEffect(() => {
    if (profile === undefined) return;
    if (profile === null) {
      setPageError("Login required");
    } else {
      if (pageError === "Login required") setPageError(null);
    }
  }, [profile, pageError]);

  // 拉取文章
  useEffect(() => {
    if (profile === undefined) return;
    if (id) {
      client.feed
        .get(id)
        .then(({ data, error }) => {
          if (error) {
            setPageError(error instanceof Error ? error.message : t("request.failed"));
            return;
          }
          if (data) {
            setFeedData(data);
          }
        });
    }
  }, [id, profile]);

  // 草稿&服务器版本对比逻辑
  useEffect(() => {
    if (!feedData) return;
    if (profile === undefined) return;
    if (profile === null) return;

    if (feedData.uid !== profile.id && !isAdmin) {
      setPageError("无权限编辑此文章");
      return;
    }

    const localModifiedAt = cache.getModifiedAt();
    const localTitle = cache.getRaw("title");
    const localContent = cache.getRaw("content");
    const serverUpdatedAt = new Date(feedData.updatedAt).getTime();
    const localDraftIsEmpty = !localTitle?.trim() && !localContent?.trim();

    // 服务器更新弹窗优先
    if (localModifiedAt !== null && serverUpdatedAt > localModifiedAt) {
      const useServer = confirm(
        "检测到服务器上有更新的版本。\n\n" +
        "点击「确定」：加载服务器最新版本\n" +
        "点击「取消」：继续编辑本地草稿"
      );
      if (useServer) {
        if (feedData.title) setTitle(feedData.title);
        if (feedData.content) setContent(feedData.content);
        if (feedData.hashtags) {
          setTags(feedData.hashtags.map((item: { name: string }) => `#${item.name}`).join(" "));
        }
        if ((feedData as any).alias) setAlias((feedData as any).alias);
        if ((feedData as any).summary) setSummary((feedData as any).summary || "");
        cache.touchModifiedAt();
      }
    } else if (localModifiedAt === null || localDraftIsEmpty) {
      if (feedData.title) setTitle(feedData.title);
      if (feedData.content) setContent(feedData.content);
      if (feedData.hashtags) {
        setTags(feedData.hashtags.map((item: { name: string }) => `#${item.name}`).join(" "));
      }
      if ((feedData as any).alias) setAlias((feedData as any).alias);
      if ((feedData as any).summary) setSummary((feedData as any).summary || "");
      cache.touchModifiedAt();
    }

    setListed((feedData as any).listed === 1);
    setDraft((feedData as any).draft === 1);
    setLoginRequired((feedData as any).loginRequired === 1);
    setCreatedAt(new Date(feedData.createdAt));
  }, [feedData, profile]);

  const debouncedUpdate = useCallback(
    _.debounce(() => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_default")
      }).then(() => {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
        });
        mermaid.run({
          suppressErrors: true,
          nodes: document.querySelectorAll("pre.mermaid_dark")
        });
      })
    }, 100),
    []
  );

  useEffect(() => {
    debouncedUpdate();
  }, [content, debouncedUpdate]);

  function PublishImageButton() {
    return null;
  }

  function PublishImageButton() {
    return null;
  }

  function PublishImageButton() {
    return null;
  }

  function PublishImageButton() {
    return null;
  }

  function PublishImageButton() {
    return null;
  }

  function PublishButton({ className }: { className?: string }) {
    return (
      <button
        onClick={publishButton}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-theme px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
        disabled={publishing}
      >
        {publishing && <Loading type="spin" height={16} width={16} />}
        <span>{t('publish.title')}</span>
      </button>
    );
  }

  function MetaInput({ className }: { className?: string }) {
    return (
      <FlatPanel className={className}>
        <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
          <FlatTabButton active={preview === 'edit'} onClick={() => setPreview('edit')}> {t("edit")} </FlatTabButton>
          <FlatTabButton active={preview === 'preview'} onClick={() => setPreview('preview')}> {t("preview")} </FlatTabButton>
          <FlatTabButton active={preview === 'comparison'} onClick={() => setPreview('comparison')}> {t("comparison")} </FlatTabButton>
          <div className="flex-grow" />
          <UploadImageButton />
          {uploading &&
            <div className="flex flex-row items-center space-x-2">
              <Loading type="spin" color="#FC466B" height={16} width={16} />
              <span className="text-sm text-neutral-500">{t('uploading')}</span>
            </div>
          }
        </FlatInset>
        <div className={`grid grid-cols-1 gap-0 sm:gap-4 ${preview === 'comparison' ? "lg:grid-cols-2" : ""}`}>
          <div className={"flex min-w-0 flex-col " + (preview === 'preview' ? "hidden" : "")}>
            <div
              className={"relative min-h-[420px] min-w-0 overflow-hidden rounded-none border-0 bg-w"}
              onDrop={(e) => {
                e.preventDefault();
                const editor = editorRef.current;
                if (!editor) return;
                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                  const selection = editor.getSelection();
                  if (!selection) return;
                  const file = e.dataTransfer.files[i];
                  setUploading(true);
                  void insertImage(file, selection, showAlert).finally(() => {
                    setUploading(false);
                  });
                }
              }}
              onPaste={handlePaste}
            >
              <Input
                id={id}
                value={title}
                setValue={setTitle}
                placeholder={t("title")}
                variant="flat"
                className="text-base"
              />
              <Input
                id={id}
                value={summary}
                setValue={setSummary}
                placeholder={t("summary")}
                variant="flat"
              />
              <Input
                id={id}
                value={alias}
                setValue={setAlias}
                placeholder={t("alias")}
                variant="flat"
              />
              <Input
                id={id}
                value={tags}
                setValue={setTags}
                placeholder={t("tags")}
                variant="flat"
                className="lg:col-span-2"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
          <FlatMetaRow
            className="cursor-pointer rounded-none border-0 bg-transparent p-3 dark:border-white/10"
            onClick={() => setDraft(!draft)}
          >
            <p>{t('visible.self_only')}</p>
            <Checkbox
              id="draft"
              value={draft}
              setValue={setDraft}
              placeholder={t('draft')}
            />
          </FlatMetaRow>
          <FlatMetaRow
            className="cursor-pointer rounded-none border-0 bg-transparent p-3 dark:border-white/10"
            onClick={() => setListed(!listed)}
          >
            <p>{t('listed')}</p>
            <Checkbox
              id="listed"
              value={listed}
              setValue={setListed}
              placeholder={t('listed')}
            />
          </FlatMetaRow>
          <FlatMetaRow
            className="cursor-pointer rounded-none border-0 bg-transparent p-3 dark:border-white/10"
            onClick={() => setLoginRequired(!loginRequired)}
          >
            <p>仅登录可见</p>
            <Checkbox
              id="loginRequired"
              value={loginRequired}
              setValue={setLoginRequired}
              placeholder="仅登录可见"
            />
          </FlatMetaRow>
          {isAdmin && (
            <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent p-3 dark:border-white/10 xl:col-span-1">
              <p className="mr-2 whitespace-nowrap">
                {t('created_at')}
              </p>
              <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[16rem]" />
            </FlatMetaRow>
          )}
        </div>
      </FlatPanel>
    )
  }

  if (pageError) {
    const isLoginRequired = pageError === "Login required";
    const isNotFound = pageError === "Not found";
    const isPermissionDenied = pageError === "Permission denied" || pageError.includes("无权限");

    let title = pageError;
    let desc = "";
    let showLoginButton = false;

    if (isLoginRequired) {
      title = "请登录后查看";
      desc = "这篇文章仅登录用户可见";
      showLoginButton = true;
    } else if (isNotFound) {
      title = "文章不存在";
      desc = "你访问的文章可能已被删除";
    } else if (isPermissionDenied) {
      title = "无权限编辑此文章";
      desc = "你没有权限编辑这篇文章";
    }

    return (
      <>
        <Helmet>
          <title>{`${title} - ${siteName.name}`}</title>
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={title} />
          <meta property="og:image" content={siteConfig.avatar} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={document.URL} />
        </Helmet>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-2xl bg-w p-8 text-center">
            <h1 className="text-2xl font-bold t-primary">{title}</h1>
            {desc && <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{desc}</p>}
            <div className="mt-6 flex gap-3 justify-center">
              {showLoginButton && (
                <button
                  onClick={() => (window.location.href = "/login")}
                  className="rounded-xl bg-theme px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-theme-hover"
                >
                  去登录
                </button>
              )}
              <button
                onClick={() => (window.location.href = "/")}
                className="rounded-xl bg-neutral-200 px-6 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
        <AlertUI />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${t('writing')} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing')} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      {!feedData ? (
        <div className="flex justify-center py-20">
          <Loading type="spin" height={40} width={40} />
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-4 sm:gap-6">
          {MetaInput({ className: "p-4 sm:p-5 md:p-6" })}
          <FlatPanel className="overflow-hidden p-0">
            <MarkdownEditor content={content} setContent={setContent} height='680px' />
          </FlatPanel>
        </div>
      )}
      <AlertUI />
    </>
  );
}