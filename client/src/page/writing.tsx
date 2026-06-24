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

async function publish({
  title,
  alias,
  listed,
  content,
  summary,
  tags,
  draft,
  loginRequired,  // 新增
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
  loginRequired: boolean;  // 新增
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
      loginRequired,  // 新增
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
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
  listed,
  draft,
  loginRequired,  // 新增
  createdAt,
  onCompleted,
  showAlert
}: {
  id: number;
  listed: boolean;
  title?: string;
  alias?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  draft?: boolean;
  loginRequired?: boolean;  // 新增
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
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
      loginRequired,  // 新增
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
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
    const [loginRequired, setLoginRequired] = useState(false);  // 新增
  const [content, setContent] = cache.useCache("content", "");
  const [pageError, setPageError] = useState<string | null>(null);  // 新增：页面错误状态
  const [feedData, setFeedData] = useState<any>(null);
  const [createdAt, setCreatedAt] = useState<Date | undefined>(new Date());
  const [publishing, setPublishing] = useState(false)
  const { showAlert, AlertUI } = useAlert()
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
        loginRequired,  // 新增
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert
      });
    } else {
      if (!title) {
        showAlert(t("title_empty"))
        return;
      }
      if (!content) {
        showAlert(t("content.empty"))
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
        loginRequired,  // 新增
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert
      });
    }
  }
  // 检查登录状态，未登录显示错误页面
  useEffect(() => {
    if (!profile) {
      setPageError("Login required");
    } else if (pageError === "Login required") {
      setPageError(null);
    }
  }, [profile]);
        useEffect(() => {
    if (id) {
      client.feed
        .get(id)
        .then(({ data, error }) => {
          if (error) {
            setPageError(error.value as string);
            return;
          }
          if (data) {
            // 先存数据，权限检查等 profile 加载完再做
            setFeedData(data);
          }
        });
    }
  }, [id]);
  // 等 profile 和文章数据都准备好了，再检查权限并填充表单
  useEffect(() => {
    if (!feedData || !profile) return;

    // 权限检查：不是自己的文章且不是管理员，禁止编辑
    if (feedData.uid !== profile.id && !isAdmin) {
      setPageError("无权限编辑此文章");
      return;
    }

    // 获取本地草稿的最后修改时间
    const localModifiedAt = cache.getModifiedAt();
    // 获取服务器的最后更新时间
    const serverUpdatedAt = new Date(feedData.updatedAt).getTime();

    if (localModifiedAt === null) {
      // 情况 1：本地没有草稿 → 直接用服务器的，不弹窗
      if (feedData.title) setTitle(feedData.title);
      if (feedData.content) setContent(feedData.content);
      if (feedData.hashtags) {
        setTags(feedData.hashtags.map(({ name }: { name: string }) => `#${name}`).join(" "));
      }
      if ((feedData as any).alias) setAlias((feedData as any).alias);
      if ((feedData as any).summary) setSummary((feedData as any).summary || "");
      // 同步时间戳
      cache.touchModifiedAt();
    } 
    else if (serverUpdatedAt > localModifiedAt) {
      // 情况 2：服务器版本更新 → 弹窗问用户要不要用服务器的
      const useServer = confirm(
        "检测到服务器上有更新的版本。\n\n" +
        "点击「确定」：加载服务器最新版本\n" +
        "点击「取消」：继续编辑本地草稿"
      );
      if (useServer) {
        // 用户选确定，用服务器版本覆盖本地
        if (feedData.title) setTitle(feedData.title);
        if (feedData.content) setContent(feedData.content);
        if (feedData.hashtags) {
          setTags(feedData.hashtags.map(({ name }: { name: string }) => `#${name}`).join(" "));
        }
        if ((feedData as any).alias) setAlias((feedData as any).alias);
        if ((feedData as any).summary) setSummary((feedData as any).summary || "");
        // 把本地草稿时间戳同步成服务器的时间
        cache.touchModifiedAt();
      }
      // 用户选取消，什么都不做，继续用本地草稿
    }
    // 情况 3：本地草稿更新，或者时间一样 → 什么都不做，继续用本地的

    // 这几个字段每次都用服务器的（因为没缓存）
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
      }).then(()=>{
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
          <div className="flex flex-row gap-4 border-b border-black/5 pb-5 dark:border-white/5 items-start justify-between">
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
              <Input
                id={id}
                value={title}
                setValue={setTitle}
                placeholder={t("title")}
                variant="flat"
                className="text-base"
              />
            </div>
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

          <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
            <FlatMetaRow
              className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
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
              className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
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
{/* 新增：仅登录可见 */}
            <FlatMetaRow
              className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
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
              <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3 xl:col-span-1">
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

   // 有错误时显示错误页面
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
            {desc && <p className="mt-2 text-sm text-neutral-500">{desc}</p>}
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
      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        {MetaInput({ className: "p-4 sm:p-5 md:p-6" })}

        <FlatPanel className="overflow-hidden p-0">
          <MarkdownEditor content={content} setContent={setContent} height='680px' />
        </FlatPanel>
      </div>
      <AlertUI />
    </>
  );
}