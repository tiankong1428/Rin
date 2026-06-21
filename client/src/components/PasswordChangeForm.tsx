import { useState } from 'react';
import { useApi } from '../hooks/use-api';

export function PasswordChangeForm() {
  const api = useApi();
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

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

    setLoading(true);
    try {
      const result = await api.user.changePassword({
        oldPassword,
        newPassword,
      });

      if (result.error) {
        throw new Error(result.error.value);
      }

      setSuccess(true);
      // 清空表单
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">修改密码</h3>
      
      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {/* 成功提示 */}
      {success && (
        <div className="p-3 bg-green-50 text-green-600 rounded-md text-sm">
          密码修改成功！
        </div>
      )}

      {/* 旧密码 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          当前密码
        </label>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="请输入当前密码"
          autoComplete="current-password"
        />
      </div>

      {/* 新密码 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          新密码
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="请输入新密码（至少 6 位）"
          autoComplete="new-password"
        />
      </div>

      {/* 确认新密码 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          确认新密码
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="请再次输入新密码"
          autoComplete="new-password"
        />
      </div>

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '保存中...' : '修改密码'}
      </button>
    </form>
  );
}