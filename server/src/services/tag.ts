import { and, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import type { DB } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feedHashtags, hashtags } from "../db/schema";
import type { AppContext } from "../core/hono-types";

export function TagService(): Hono {
    const app = new Hono();

    // GET /tag - 标签列表
    app.get('/', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const uid = c.get('uid');

        const tag_list = await profileAsync(c, 'tag_list_db', () => db.query.hashtags.findMany({
            with: {
                feeds: {
                    columns: { feedId: true },
                    with: {
                        feed: {
                            columns: { id: true },
                            // 只查出用户能看到的文章
                            where: (feeds: any) => {
                                if (!uid) {
                                    // 未登录：只能看公开且非仅登录可见的
                                    return and(eq(feeds.draft, 0), eq(feeds.listed, 1), eq(feeds.loginRequired, 0));
                                } else if (admin) {
                                    // 管理员：所有非草稿的 + 自己的草稿
                                    return or(
                                        eq(feeds.draft, 0),
                                        and(eq(feeds.draft, 1), eq(feeds.uid, uid))
                                    );
                                } else {
                                    // 普通用户：公开的 + 自己的草稿
                                    return or(
                                        and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                        and(eq(feeds.draft, 1), eq(feeds.uid, uid))
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }));

        // 过滤掉用户看不到任何文章的标签
        const visibleTags = tag_list.filter((tag: any) => {
            return tag.feeds.some((f: any) => f.feed !== null);
        });

        // 统计用户能看到的文章数量
        const result = visibleTags.map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt,
            feeds: tag.feeds.filter((f: any) => f.feed !== null).length
        }));

        return c.json(result);
    });

    // GET /tag/:name - 标签详情
    app.get('/:name', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const nameDecoded = decodeURI(c.req.param('name'));

        const tag = await profileAsync(c, 'tag_detail_db', () => db.query.hashtags.findFirst({
            where: eq(hashtags.name, nameDecoded),
            with: {
                feeds: {
                    with: {
                        feed: {
                            columns: {
                                id: true, title: true, summary: true, content: true, 
                                createdAt: true, updatedAt: true, draft: false, listed: false
                            },
                            with: {
                                user: { columns: { id: true, username: true, avatar: true } },
                                hashtags: {
                                    columns: {},
                                    with: { hashtag: { columns: { id: true, name: true } } }
                                }
                            },
                            // 根据用户权限过滤文章
                            where: (feeds: any) => {
                                if (!uid) {
                                    // 未登录：只能看公开且非仅登录可见的
                                    return and(eq(feeds.draft, 0), eq(feeds.listed, 1), eq(feeds.loginRequired, 0));
                                } else if (admin) {
                                    // 管理员：所有非草稿的 + 自己的草稿
                                    return or(
                                        eq(feeds.draft, 0),
                                        and(eq(feeds.draft, 1), eq(feeds.uid, uid))
                                    );
                                } else {
                                    // 普通用户：公开的 + 自己的草稿
                                    return or(
                                        and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                        and(eq(feeds.draft, 1), eq(feeds.uid, uid))
                                    );
                                }
                            }
                        } as any
                    }
                }
            }
        }));

        if (!tag) {
            return c.text('Not found', 404);
        }

        const tagFeeds = tag.feeds.map((tagFeed: any) => {
            if (!tagFeed.feed) return null;
            return {
                ...tagFeed.feed,
                hashtags: tagFeed.feed.hashtags.map((hashtag: any) => hashtag.hashtag)
            };
        }).filter((feed: any) => feed !== null);

        return c.json({ ...tag, feeds: tagFeeds });
    });

    return app;
}

export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    await db.delete(feedHashtags).where(eq(feedHashtags.feedId, feedId));
    for (const tag of tags) {
        const tagId = await getTagIdOrCreate(db, tag);
        await db.insert(feedHashtags).values({
            feedId: feedId,
            hashtagId: tagId
        });
    }
}

async function getTagByName(db: DB, name: string) {
    return await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
}

async function getTagIdOrCreate(db: DB, name: string) {
    const tag = await getTagByName(db, name);
    if (tag) {
        return tag.id;
    } else {
        const result = await db.insert(hashtags).values({ name }).returning({ insertedId: hashtags.id });
        if (result.length === 0) {
            throw new Error('Failed to insert');
        } else {
            return result[0].insertedId;
        }
    }
}