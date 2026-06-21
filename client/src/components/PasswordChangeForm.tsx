import { useState } from 'react';
import { client } from '../app/runtime';
import { ButtonWithLoading } from './button';
import { Input } from './input';

export function PasswordChangeForm() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        // 前端校验
        if (!oldPassword || !newPassword || !confirmPassword) {
            setError('请填写所有密码字段');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('两次输入的新密码不一致');
            return;
        }

        if (newPassword.length < 6) {
            setError('新密码至少需要 6 个字符');
            return;
        }

        setIsLoading(true);
        try {
            const { error: apiError } = await client.user.changePassword({
                oldPassword,
                newPassword,
            });

            if (apiError) {
                setError(apiError.value || '修改失败');
                return;
            }

                        setSuccess('密码修改成功！正在跳转到登录页...');
            
            // 1 秒后跳转到登录页
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } catch (err) {
            setError('网络错误，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold t-primary">修改密码</h2>
            
            {/* 错误提示 */}
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}
            
            {/* 成功提示 */}
            {success && (
                <p className="text-sm text-green-500">{success}</p>
            )}

            {/* 旧密码 */}
            <div className="space-y-2">
                <label className="text-sm font-medium t-secondary">当前密码</label>
                <Input
                    type="password"
                    value={oldPassword}
                    setValue={setOldPassword}
                    placeholder="请输入当前密码"
                    disabled={isLoading}
                />
            </div>

            {/* 新密码 */}
            <div className="space-y-2">
                <label className="text-sm font-medium t-secondary">新密码</label>
                <Input
                    type="password"
                    value={newPassword}
                    setValue={setNewPassword}
                    placeholder="请输入新密码（至少 6 位）"
                    disabled={isLoading}
                />
            </div>

            {/* 确认新密码 */}
            <div className="space-y-2">
                <label className="text-sm font-medium t-secondary">确认新密码</label>
                <Input
                    type="password"
                    value={confirmPassword}
                    setValue={setConfirmPassword}
                    placeholder="请再次输入新密码"
                    disabled={isLoading}
                />
            </div>

            {/* 提交按钮 */}
            <div className="pt-2">
                <ButtonWithLoading
                    title={isLoading ? '保存中...' : '修改密码'}
                    onClick={handleSubmit}
                    loading={isLoading}
                />
            </div>
        </div>
    );
}