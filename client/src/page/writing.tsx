useEffect(() => {
    if (id) {
        client.feed
            .get(id)
            .then(({ data }) => {
                if (data) {
                    // 获取本地草稿的最后修改时间
                    const localModifiedAt = cache.getModifiedAt();
                    // 获取服务器的最后更新时间
                    const serverUpdatedAt = new Date(data.updatedAt).getTime();
                    
                    // 判断：本地有草稿，而且本地草稿比服务器新
                    const hasLocalNewerDraft = 
                        localModifiedAt && localModifiedAt > serverUpdatedAt;
                    
                    if (hasLocalNewerDraft) {
                        // 本地草稿更新，弹窗问用户用哪个
                        const useLocal = confirm(
                            "检测到您有未保存的本地草稿，比服务器版本新。\n\n" +
                            "点击「确定」：继续编辑本地草稿（可能不是最新版本）\n" +
                            "点击「取消」：加载服务器最新版本"
                        );
                        
                        if (useLocal) {
                            // 用户选择用本地草稿，什么都不做
                            // 但是这几个字段还是要用服务器的（因为没缓存）
                            setListed((data as any).listed === 1);
                            setDraft((data as any).draft === 1);
                            setCreatedAt(new Date(data.createdAt));
                            return;
                        }
                    }
                    
                    // 用服务器最新版本
                    if (data.title) setTitle(data.title);
                    if (data.content) setContent(data.content);
                    if (data.hashtags) {
                        setTags(data.hashtags.map(({ name }: { name: string }) => `#${name}`).join(" "));
                    }
                    if ((data as any).alias) setAlias((data as any).alias);
                    if ((data as any).summary) setSummary((data as any).summary || "");
                    
                    setListed((data as any).listed === 1);
                    setDraft((data as any).draft === 1);
                    setCreatedAt(new Date(data.createdAt));
                    
                    // 把本地草稿时间戳同步成服务器的时间
                    cache.touchModifiedAt();
                }
            });
    }
}, []);