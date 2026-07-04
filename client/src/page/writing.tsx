import i18n from 'i18next';
import _ from 'lodash';
import { useCallback, useContext, useEffect, useState, useRef, useMemo } from "react";
import { ProfileContext } from '../state/profile';
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { ShowAlertType, useAlert } from '../components/dialog';
import { Checkbox, Input } from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel } from "@rin/ui";
import { client } from "../app/runtime";
import { Cache } from '../utils/cache';
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import mermaid from 'mermaid';
import { MarkdownEditor } from '../components/markdown_editor';

// ---------- 发布 / 更新逻辑 ----------
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
  showAlert,
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
  const t = i18n.t;
  const { data, error } = await client.feed.create({
    title,
    alias,
    content,
    summary,
    tags,
    listed,
    draft,
    loginRequired,
    createdAt: createdAt?.toISOString(),
  });

  // 成功时立即清除缓存，避免后续对比逻辑触发
  if (data) {
    Cache.with().clear();
  }

  if (onCompleted) onCompleted();

  if (error) {
    showAlert(typeof error === "string" ? error : t("upload.failed"));
  }
  if (data) {
    showAlert(t("publish.success"), () => {
      window.location.href = "/feed/" + data.insertedId;
      // 缓存已在上面清除
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
  listed,
  draft,
  loginRequired,
  createdAt,
  onCompleted,
  showAlert,
}: {
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
}) {
  const t = i18n.t;
  const { error } = await client.feed.update(id, {
    title,
    alias,
    content,
    summary,
    tags,
    listed,
    draft,
    loginRequired,
    createdAt: createdAt?.toISOString(),
  });

  // 成功时立即清除缓存，避免后续对比逻辑触发
  if (!error) {
    Cache.with(id).clear();
  }

  if (onCompleted) onCompleted();

  if (error) {
    showAlert(typeof error === "string" ? error : t("upload.failed"));
  } else {
    showAlert(t("update.success"), () => {
      window.location.href = "/feed/" + id;
      // 缓存已在上面清除
    });
  }
}

// ---------- 主组件 ----------
export function WritingPage({ id }: { id?: number }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  
  // 稳定 cache 引用，避免依赖变化导致 effect 重复执行
  const cache = useMemo(() => Cache.with(id), [id]);
  
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
  const [publishing, setPublishing] = useState(false);
  const { showAlert, AlertUI } = useAlert();
  const profile = useContext(ProfileContext);
  const isAdmin = profile?.permission ?? false;

  // 提交操作锁
  const isSubmitProcessing = useRef(false);
  const [initLock, setInitLock] = useState(true);
  const [cacheReady, setCacheReady] = useState(false);

  // 解锁缓存延时锁
  useEffect(() => {
    const timer = setTimeout(() => setInitLock(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // 缓存就绪判断
  useEffect(() => {
    if (!initLock) {
      const modifiedAt = cache.getModifiedAt();
      setCacheReady(modifiedAt !== null || content !== "");
    }
  }, [initLock, cache, content]);

  // ---------- 复原服务器内容 ----------
  function handleRestoreServer() {
    if (!feedData) return;
    const ok = confirm("确定将丢弃本地所有草稿，使用服务器最新内容？");
    if (!ok) return;
    if (feedData.title) setTitle(feedData.title);
    if (feedData.content) setContent(feedData.content);
    if (feedData.hashtags) {
      setTags(feedData.hashtags.map((item: { name: string }) => `#${item.name}`).join(" "));
    }
    if ((feedData as any).alias) setAlias((feedData as any).alias);
    if ((feedData as any).summary) setSummary((feedData as any).summary || "");
    queueMicrotask(() => cache.touchModifiedAt());
  }

  // ---------- 发布按钮 ----------
  function publishButton() {
    if (publishing) return;
    const tagsplit = tags.split("#").filter(tag => tag.trim()).map(tag => tag.trim());
    isSubmitProcessing.current = true;
    if (id !== undefined) {
      setPublishing(true);
      update({
        id,
        listed,
        title,
        content,
        summary,
        alias,
        tags: tagsplit,
        draft,
        loginRequired,
        createdAt,
        onCompleted: () => {
          setPublishing(false);
          setTimeout(() => {
            isSubmitProcessing.current = false;
          }, 500);
        },
        showAlert,
      });
    } else {
      if (!title.trim()) return showAlert(t("title.empty"));
      if (!content.trim()) return showAlert(t("content.empty"));
      setPublishing(true);
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
          setPublishing(false);
          setTimeout(() => {
            isSubmitProcessing.current = false;
          }, 500);
        },
        showAlert,
      });
    }
  }

  // 登录状态检测
  useEffect(() => {
    if (profile === undefined) return;
    if (profile === null) setPageError("Login required");
    else if (pageError === "Login required") setPageError(null);
  }, [profile, pageError]);

  // ---------- 拉取文章数据（仅编辑模式，且 id/cache 稳定时请求一次） ----------
  useEffect(() => {
    if (!id) return;
    client.feed.get(id).then(({ data, error }) => {
      if (error) {
        setPageError(typeof error === "string" ? error : i18n.t("request.failed"));
        return;
      }
      if (data) {
        setFeedData(data);
        const localModifiedAt = cache.getModifiedAt();
        if (localModifiedAt === null) {
          if (data.title) setTitle(data.title);
          if (data.content) setContent(data.content);
          if (data.hashtags) setTags(data.hashtags.map((item: { name: string }) => `#${item.name}`).join(" "));
          if ((data as any).alias) setAlias((data as any).alias);
          if ((data as any).summary) setSummary((data as any).summary || "");
          cache.touchModifiedAt();
        }
      }
    });
    // 仅依赖 id 和稳定的 cache 引用，不会因其他无关状态变化重复请求
  }, [id, cache]);

  // ---------- 草稿对比 / 服务器数据覆盖逻辑 ----------
  useEffect(() => {
    if (isSubmitProcessing.current) return;
    if (!id) return;
    if (!feedData || initLock || !cacheReady || publishing) return;
    if (profile === undefined || profile === null) return;
    if (feedData.uid !== profile.id && !isAdmin) {
      setPageError("无权限编辑此文章");
      return;
    }

    const localModifiedAt = cache.getModifiedAt();
    if (localModifiedAt === null) return;

    const serverUpdatedAt = new Date(feedData.updatedAt).getTime();
    if (serverUpdatedAt > localModifiedAt) {
      const useServer = confirm(
        "检测到服务器上有更新的版本。\n\n" +
        "点击「确定」：加载服务器最新版本\n" +
        "点击「取消」：继续编辑本地草稿"
      );
      if (useServer) {
        if (feedData.title) setTitle(feedData.title);
        if (feedData.content) setContent(feedData.content);
        if (feedData.hashtags) setTags(feedData.hashtags.map((item: { name: string }) => `#${item.name}`).join(" "));
        if ((feedData as any).alias) setAlias((feedData as any).alias);
        if ((feedData as any).summary) setSummary((feedData as any).summary || "");
        queueMicrotask(() => cache.touchModifiedAt());
      }
      return;
    }

    setListed(!!feedData.listed);
    setDraft(!!feedData.draft);
    setLoginRequired(!!feedData.loginRequired);
    if (feedData.createdAt) setCreatedAt(new Date(feedData.createdAt));
  }, [feedData, profile, initLock, cacheReady, id, publishing, isAdmin, cache]);

  // mermaid 渲染防抖
  const debouncedUpdate = useCallback(
    _.debounce(() => {
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_default"),
      })
        .then(() => {
          mermaid.initialize({ startOnLoad: false, theme: "dark" });
          mermaid.run({
            suppressErrors: true,
            nodes: document.querySelectorAll("pre.mermaid_dark"),
          });
        });
    }, 100),
    []
  );
  useEffect(() => debouncedUpdate(), [content, debouncedUpdate]);

  // 发布按钮 UI
  function PublishButton({ className }: { className?: string }) {
    return (
      <button
        onClick={publishButton}
        className={`inline-flex items-center gap-2 rounded-xl bg-theme px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
        disabled={publishing}
      >
        {publishing && <Loading type="spin" height={16} width={16} />}
        <span>{t('publish.title')}</span>
      </button>
    );
  }

  // 元信息输入面板
  function MetaInput({ className }: { className?: string }) {
    return (
      <FlatPanel className={className}>
        <div className="flex flex-row gap-4 border-b border-black/10 pb-5 dark:border-white/10 items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t('writing')}</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {id !== undefined ? t("update.title") : t("publish.title")}
            </p>
          </div>
          <PublishButton className="w-auto" />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Input id={id} value={title} setValue={setTitle} placeholder={t("title")} variant="flat" className="text-base" />
          </div>
          <Input id={id} value={summary} setValue={setSummary} placeholder={t("summary")} variant="flat" />
          <Input id={id} value={alias} setValue={setAlias} placeholder={t("alias")} variant="flat" />
          <Input id={id} value={tags} setValue={setTags} placeholder={t("tags")} variant="flat" className="lg:col-span-2" />
        </div>
        <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
          <FlatMetaRow
            className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
            onClick={() => setDraft(!draft)}
          >
            <p>{t('visible.self_only')}</p>
            <Checkbox id="draft" value={draft} setValue={setDraft} placeholder={t('draft')} />
          </FlatMetaRow>
          <FlatMetaRow
            className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
            onClick={() => setListed(!listed)}
          >
            <p>{t('listed')}</p>
            <Checkbox id="listed" value={listed} setValue={setListed} placeholder={t('listed')} />
          </FlatMetaRow>
          <FlatMetaRow
            className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
            onClick={() => setLoginRequired(!loginRequired)}
          >
            <p>仅登录可见</p>
            <Checkbox id="loginRequired" value={loginRequired} setValue={setLoginRequired} placeholder="仅登录可见" />
          </FlatMetaRow>
          {isAdmin && (
            <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3 xl:col-span-1">
              <p className="mr-2 whitespace-nowrap">{t('created_at')}</p>
              <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[16rem]" />
            </FlatMetaRow>
          )}
        </div>
      </FlatPanel>
    );
  }

  // 错误页面
  if (pageError) {
    const isLoginRequired = pageError === "Login required";
    const isNotFound = pageError === "Not found";
    const isPermissionDenied = pageError.includes("无权限");
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
          <title>{`${title} - ${siteConfig.name}`}</title>
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

  // 新建写作页直接渲染编辑器，不加载 loading
  if (!id) {
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
        <div className="mt-2 flex flex-col gap-4 sm:gap-6">
          <MetaInput className="p-4 sm:p-5 md:p-6" />
          <FlatPanel className="overflow-hidden p-0">
            <MarkdownEditor content={content} setContent={setContent} height='680px' onRestoreServer={handleRestoreServer} />
          </FlatPanel>
        </div>
        <AlertUI />
      </>
    );
  }

  // 编辑模式等待接口加载
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
          <MetaInput className="p-4 sm:p-5 md:p-6" />
          <FlatPanel className="overflow-hidden p-0">
            <MarkdownEditor content={content} setContent={setContent} height='680px' onRestoreServer={handleRestoreServer} />
          </FlatPanel>
        </div>
      )}
      <AlertUI />
    </>
  );
}