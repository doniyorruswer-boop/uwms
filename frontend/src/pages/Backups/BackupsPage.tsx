import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Grid,
  Alert,
  Popconfirm,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStorage,
  IconClockCircle,
  IconCloudDownload,
  IconDelete,
  IconUndo,
  IconLock,
} from '@arco-design/web-react/icon';
import {
  useBackupsQuery,
  useBackupStatsQuery,
  useCreateBackupMutation,
  useRestoreBackupMutation,
  useDeleteBackupMutation,
} from '../../hooks/useBackupsQuery';
import { backupsApi, BackupItem } from '../../api/backups.api';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { TableActions } from '../../components/Common/TableActions';
import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

export const BackupsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [backupType, setBackupType] = useState<string>('ALL');

  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState<boolean>(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string>('');

  const [createForm] = Form.useForm();

  const {
    data: backupsData,
    isLoading: isBackupsLoading,
    isError: isBackupsError,
    refetch: refetchBackups,
  } = useBackupsQuery({
    page,
    limit: pageSize,
    search: search.trim() || undefined,
    backupType: backupType !== 'ALL' ? backupType : undefined,
  });

  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useBackupStatsQuery();

  const createMutation = useCreateBackupMutation();
  const restoreMutation = useRestoreBackupMutation();
  const deleteMutation = useDeleteBackupMutation();

  const handleRefresh = () => {
    refetchBackups();
    refetchStats();
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validate();
      await createMutation.mutateAsync(values.notes);
      createForm.resetFields();
      setCreateModalVisible(false);
    } catch {
      // Form validation error
    }
  };

  const handleRestoreSubmit = async () => {
    if (!selectedBackup) return;
    try {
      await restoreMutation.mutateAsync({
        id: selectedBackup.id,
        confirmation: confirmationCode,
      });
      setRestoreModalVisible(false);
      setSelectedBackup(null);
      setConfirmationCode('');
    } catch {
      // Handled by mutation error
    }
  };

  // 1. Permission Denied UX State
  if (!isSuperAdmin) {
    return (
      <Card style={{ margin: 20 }}>
        <Alert
          type="warning"
          icon={<IconLock />}
          title="Ruxsat Cheklangan (Permission Denied)"
          content="Ma’lumotlar bazasi zaxira nusxalarini (Backup & Restore) boshqarish faqat Bosh Administrator (SUPER_ADMIN) vakolatiga kiradi."
        />
      </Card>
    );
  }

  // 2. Error UX State
  if (isBackupsError) {
    return (
      <Card style={{ margin: 20 }}>
        <Alert
          type="error"
          title="Ma’lumotlarni yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzilgan yoki ichki xatolik yuzaga keldi. Iltimos, qaytadan urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={handleRefresh}>
              Qayta yuklash
            </Button>
          }
        />
      </Card>
    );
  }

  const columns = [
    {
      title: 'Fayl Nomi',
      dataIndex: 'filename',
      key: 'filename',
      render: (filename: string, record: BackupItem) => (
        <Space direction="vertical" size={2}>
          <Text bold style={{ fontFamily: 'monospace', color: '#165DFF' }}>
            {filename}
          </Text>
          {record.notes && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.notes}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Hajmi',
      dataIndex: 'fileSizeFormatted',
      key: 'fileSizeFormatted',
      width: 110,
      render: (size: string) => <Tag color="arcoblue">{size || '0 B'}</Tag>,
    },
    {
      title: 'Turi',
      dataIndex: 'backupType',
      key: 'backupType',
      width: 120,
      render: (type: string) =>
        type === 'AUTOMATIC' ? (
          <Tag color="cyan">Avtomatik</Tag>
        ) : (
          <Tag color="green">Qo‘lda</Tag>
        ),
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => {
        switch (status) {
          case 'COMPLETED':
            return <Tag color="green">Tayyor</Tag>;
          case 'RESTORED':
            return <Tag color="purple">Tiklandi</Tag>;
          case 'IN_PROGRESS':
            return <Tag color="gold">Jarayonda</Tag>;
          case 'FAILED':
            return <Tag color="red">Xato</Tag>;
          default:
            return <Tag>{status}</Tag>;
        }
      },
    },
    {
      title: 'SHA-256 Xesh (Butunlik)',
      dataIndex: 'checksum',
      key: 'checksum',
      width: 160,
      render: (checksum?: string) =>
        checksum ? (
          <Tooltip content={checksum}>
            <Text code style={{ fontSize: 11 }}>
              {checksum.slice(0, 12)}...
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Yaratilgan Sana',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => new Date(val).toLocaleString('uz-UZ'),
    },
    {
      title: 'Mas’ul Shaxs',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 160,
      render: (user?: BackupItem['triggeredBy']) =>
        user ? (
          <Text>{user.fullName}</Text>
        ) : (
          <Text type="secondary">Tizim (Rejali)</Text>
        ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: BackupItem) => (
        <TableActions
          onDelete={isSuperAdmin ? () => deleteMutation.mutate(record.id) : undefined}
          deleteConfirmTitle="Ushbu zaxira nusxasini o‘chirishni tasdiqlaysizmi?"
          deleteOkText="Ha, o‘chirilsin"
          deleteCancelText="Bekor qilish"
          deleteTooltip="O‘chirish"
          rightPadding={16}
        >
          <Tooltip content="Yuklab olish">
            <Button
              size="small"
              icon={<IconCloudDownload />}
              onClick={() => backupsApi.downloadBackup(record.id, record.filename)}
              style={{ borderRadius: 0 }}
            />
          </Tooltip>

          <Tooltip content="Zaxiradan tiklash">
            <Button
              size="small"
              status="warning"
              icon={<IconUndo />}
              onClick={() => {
                setSelectedBackup(record);
                setConfirmationCode('');
                setRestoreModalVisible(true);
              }}
              style={{ borderRadius: 0 }}
            />
          </Tooltip>
        </TableActions>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Page Title & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Title heading={5} style={{ margin: 0 }}>
            Ma’lumotlar Bazasi Zaxiralari (Disaster Recovery)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Tizim ma’lumotlar bazasining to‘liq xavfsizlik nusxalari va tiklash jurnali
          </Text>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={handleRefresh}>
            Yangilash
          </Button>
          <Button
            type="primary"
            icon={<IconPlus />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalVisible(true);
            }}
          >
            Yangi Zaxira Yaratish
          </Button>
        </Space>
      </div>

      {/* KPI Stats Hero Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <StatHeroCard
            title="Jami Zaxira Nusxalari"
            value={stats?.totalCount ?? 0}
            subtext={`${stats?.automaticCount ?? 0} ta avtomatik, ${stats?.manualCount ?? 0} ta qo‘lda`}
            icon={<IconStorage />}
            color="blue"
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatHeroCard
            title="Umumiy Egallagan Disk Hajmi"
            value={stats?.totalStorageFormatted ?? '0 B'}
            subtext="Diskdagi barcha .dump fayllar hajmi"
            icon={<IconCloudDownload />}
            color="teal"
          />
        </Col>
        <Col xs={24} sm={24} md={8}>
          <StatHeroCard
            title="Avtomatik Rejalashtiruvchi"
            value={stats?.schedulerActive ? 'Faol Rejimda' : 'Nofaol'}
            subtext={stats?.schedulerSchedule || 'Har kuni 02:00 da (UTC+5)'}
            icon={<IconClockCircle />}
            color="green"
          />
        </Col>
      </Row>

      {/* Search & Filter Toolbar */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={[16, 12]} justify="space-between" align="center">
          <Col xs={24} sm={14} md={10}>
            <Input
              allowClear
              prefix={<IconSearch />}
              placeholder="Fayl nomi yoki izoh bo‘yicha qidiruv..."
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
            />
          </Col>
          <Col xs={24} sm={10} md={6}>
            <Select
              style={{ width: '100%' }}
              value={backupType}
              onChange={(val) => {
                setBackupType(val);
                setPage(1);
              }}
            >
              <Select.Option value="ALL">Barcha Turlar</Select.Option>
              <Select.Option value="AUTOMATIC">Faqat Avtomatik</Select.Option>
              <Select.Option value="MANUAL">Faqat Qo‘lda</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Backups Table */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isBackupsLoading || isStatsLoading}
          columns={columns}
          data={backupsData?.items || []}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: backupsData?.total || 0,
            showTotal: true,
            sizeCanChange: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* Modal: Yangi Zaxira Yaratish */}
      <Modal
        title="Yangi Zaxira Nusxasi Yaratish"
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setCreateModalVisible(false)}>Bekor qilish</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={handleCreateSubmit}
            >
              Zaxirani Boshlash
            </Button>
          </Space>
        }
      >
        <Paragraph type="secondary">
          Tizim PostgreSQL ma’lumotlar bazasining to‘liq xavfsizlik nusxasini (.dump) yaratadi va
          diskda xesh qiymati bilan arxivlaydi.
        </Paragraph>
        <Form form={createForm} layout="vertical">
          <Form.Item label="Izoh yoki Sabab" field="notes">
            <Input.TextArea
              placeholder="Masalan: Tizim versiyasi yangilanishidan oldingi zaxira..."
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Zaxira Nusxasini Tiklash */}
      <Modal
        title="Zaxira Nusxasidan Baza Holatini Tiklash"
        visible={restoreModalVisible}
        onCancel={() => {
          setRestoreModalVisible(false);
          setSelectedBackup(null);
        }}
        footer={
          <Space>
            <Button onClick={() => setRestoreModalVisible(false)}>Bekor qilish</Button>
            <Button
              type="primary"
              status="danger"
              loading={restoreMutation.isPending}
              disabled={confirmationCode.trim().toUpperCase() !== 'TIKLASH'}
              onClick={handleRestoreSubmit}
            >
              Tiklashni Tasdiqlash
            </Button>
          </Space>
        }
      >
        <Alert
          type="error"
          style={{ marginBottom: 16 }}
          title="DIQQAT: Ma’lumotlar qayta yozilishi mumkin!"
          content={`Siz "${selectedBackup?.filename}" faylidan ma’lumotlar bazasini tiklamoqchisiz. Davom etish uchun pastdagi maydonga "TIKLASH" so‘zini bosh harflar bilan kiriting.`}
        />
        <Form layout="vertical">
          <Form.Item label="Tasdiqlash kodi: TIKLASH">
            <Input
              placeholder="TIKLASH deb yozing"
              value={confirmationCode}
              onChange={(val) => setConfirmationCode(val)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BackupsPage;
