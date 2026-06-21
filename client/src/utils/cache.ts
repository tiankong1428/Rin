import React from "react";

export type Keys =
    | "title"
    | "content"
    | "tags"
    | "summary"
    | "draft"
    | "alias"
    | "listed"
    | "preview"
    | "modifiedAt"  // 新增：本地草稿最后修改时间
    ;

const keys: Keys[] = [
    "title",
    "content",
    "tags",
    "summary",
    "draft",
    "alias",
    "listed",
    "preview",
    "modifiedAt",  // 新增
];

export class Cache {
    static with(id?: number) {
        return new Cache(id);
    }

    private id: string;

    constructor(id?: number) {
        this.id = `${id ?? "new"}`;
    }

    public get(key: Keys) {
        return localStorage.getItem(`${this.id}/${key}`);
    }

    public set(key: Keys, value: string) {
        if (value === "") localStorage.removeItem(`${this.id}/${key}`);
        else localStorage.setItem(`${this.id}/${key}`, value);
    }

    clear() {
        keys.forEach((key) => {
            localStorage.removeItem(`${this.id}/${key}`);
        });
    }

    // ========== 新增：时间戳相关方法 ==========
    
    // 获取本地草稿的最后修改时间
    public getModifiedAt(): number | null {
        const timeStr = this.get("modifiedAt" as Keys);
        return timeStr ? parseInt(timeStr, 10) : null;
    }

    // 更新本地草稿的修改时间为当前时间
    public touchModifiedAt() {
        this.set("modifiedAt" as Keys, Date.now().toString());
    }

    // ==========================================

    public useCache<T>(key: Keys, initialValue: T) {
        const [value, setValue] = React.useState<T>(this.get(key) as T ?? initialValue);

        const setCache = (value: T) => {
            this.set(key, value as string);
            this.touchModifiedAt();  // 新增：每次修改都更新时间戳
            setValue(value);
        }

        return [value, setCache] as const;
    }
}

export function useCache<T>(key: Keys, initialValue: T) {
    return new Cache().useCache(key, initialValue)
}