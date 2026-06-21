import { useState } from "react";
import { Helmet } from "react-helmet";
import { ButtonWithLoading } from "../components/button";
import { Input } from "../components/input";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";

export function UserCreatePage() {
    const { showAlert, AlertUI } = useAlert();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        setError("");

        // 前端校验
        if (!username || username.trim() === "") {
            setError("请输入用户名");
            return;
        }

        if (!password || password.length < 6) {
            setError("密码至少需要 6 个字符");
            return;
        }

        if (password !== confirmPassword) {
            setError("两次输入的密码不一致");
            return;
        }

        setIsLoading(true);
        try {
            const { error: apiError } = await client.user.createUser({
                username: username.trim(),
                password,
            });

            if (apiError) {
                setError(apiError.value || "创建失败");
                return;
            }

            showAlert("用户创建成功！", () => {
                // 清空表单
                setUsername("");
                setPassword("");
                setConfirmPassword("");
            });
        } catch (err) {
            setError("网络错误，请重试");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
                <Helmet>
                    <title>创建用户 - 后台管理</title>
                </Helmet>
                
                <p className="text-2xl font-bold">创建新用户</p>
                
                {/* 错误提示 */}
                {error && (
                    <p className="text-sm text-red-500 w-full">{error}</p>
                )}

                {/* 用户名 */}
                <div className="w-full space-y-2">
                    <label className="text-sm font-medium t-secondary">用户名</label>
                    <Input
                        value={username}
                        setValue={setUsername}
                        placeholder="请输入用户名"
                        disabled={isLoading}
                    />
                </div>

                {/* 密码 */}
                <div className="w-full space-y-2">
                    <label className="text-sm font-medium t-secondary">密码</label>
                    <Input
                        type="password"
                        value={password}
                        setValue={setPassword}
                        placeholder="请输入密码（至少 6 位）"
                        disabled={isLoading}
                    />
                </div>

                {/* 确认密码 */}
                <div className="w-full space-y-2">
                    <label className="text-sm font-medium t-secondary">确认密码</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        setValue={setConfirmPassword}
                        placeholder="请再次输入密码"
                        disabled={isLoading}
                        onSubmit={handleSubmit}
                    />
                </div>

                {/* 提交按钮 */}
                <div className="w-full pt-2">
                    <ButtonWithLoading
                        title={isLoading ? "创建中..." : "创建用户"}
                        onClick={handleSubmit}
                        loading={isLoading}
                    />
                </div>
            </div>
            <AlertUI />
        </div>
    );
}