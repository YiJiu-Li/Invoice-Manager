import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, Popconfirm, Tag, message, Space } from 'antd';
import { PlusOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons';
import { listUsers, createUser, deleteUser, resetUserPassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { AuthUser, UserCreateRequest } from '../types/user';
import styles from './UserManagePage.module.css';

export default function UserManagePage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState<{ open: boolean; userId: number | null; username: string }>({
    open: false, userId: null, username: '',
  });
  const [createForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (values: UserCreateRequest) => {
    try {
      await createUser(values);
      message.success('用户创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '创建失败');
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      await deleteUser(userId);
      message.success('用户已删除');
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    }
  };

  const handleResetPassword = async (values: { new_password: string }) => {
    if (!resetModalOpen.userId) return;
    try {
      await resetUserPassword(resetModalOpen.userId, values.new_password);
      message.success('密码已重置');
      setResetModalOpen({ open: false, userId: null, username: '' });
      resetForm.resetFields();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '重置失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (name: string, record: AuthUser) => (
        <Space>
          {name}
          {record.id === currentUser?.id && <Tag color="blue">当前账号</Tag>}
        </Space>
      ),
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (v: string | null) => v || '-',
    },
    {
      title: '角色',
      dataIndex: 'is_admin',
      key: 'is_admin',
      render: (v: boolean) => v ? <Tag color="red">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AuthUser) => (
        <Space>
          <Button
            size="small"
            icon={<KeyOutlined />}
            onClick={() => setResetModalOpen({ open: true, userId: record.id, username: record.username })}
          >
            重置密码
          </Button>
          {record.id !== currentUser?.id && (
            <Popconfirm
              title={`确定删除用户 "${record.username}"？`}
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>用户管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          新建用户
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={false}
      />

      {/* Create User Modal */}
      <Modal
        title="新建用户"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="留空则使用用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6位' }]}
          >
            <Input.Password placeholder="至少6位" />
          </Form.Item>
          <Form.Item name="is_admin" label="管理员权限" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        title={`重置密码：${resetModalOpen.username}`}
        open={resetModalOpen.open}
        onCancel={() => { setResetModalOpen({ open: false, userId: null, username: '' }); resetForm.resetFields(); }}
        onOk={() => resetForm.submit()}
        okText="重置"
        cancelText="取消"
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword} style={{ marginTop: 16 }}>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6位' }]}
          >
            <Input.Password placeholder="至少6位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
