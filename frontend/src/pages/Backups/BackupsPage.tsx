import React, { useState } from 'react';
import {
  Card,
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
import { StandardTable } from '../../components/Common/StandardTable';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
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
      minWidth: 320,
      render: (filename: string, record: BackupItem) => (
        <div style={{ paddingLeft: 8 }}>
          <CategoryThumbnail
            icon={<IconStorage />}
            name={filename}
            subtitle={record.notes || undefined}
            color="#165DFF"
            bg="#E8F3FF"
          />
        </div>
      ),
    },
    {
      title: 'Hajmi',
      dataIndex: 'fileSizeFormatted',
      key: 'fileSizeFormatted',
      width: 90,
      render: (size: string) => (
        <Tag color="arcoblue" size="small" style={{ borderRadius: 0, fontWeight: 600 }}>
          {size || '0 B'}
        </Tag>
      ),
    },
    {
      title: 'Turi',
      dataIndex: 'backupType',
      key: 'backupType',
      width: 95,
      render: (type: string) =>
        type === 'AUTOMATIC' ? (
          <Tag color="cyan" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>
            Avtomatik
          </Tag>
        ) : (
          <Tag color="green" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>
            Qo‘lda
          </Tag>
        ),
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      key: 'status',
      width: 95,
      render: (status: string) => {
        switch (status) {
          case 'COMPLETED':
            return <Tag color="green" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>Tayyor</Tag>;
          case 'RESTORED':
            return <Tag color="purple" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>Tiklandi</Tag>;
          case 'IN_PROGRESS':
            return <Tag color="gold" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>Jarayonda</Tag>;
          case 'FAILED':
            return <Tag color="red" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>Xato</Tag>;
          default:
            return <Tag size="small" style={{ borderRadius: 0 }}>{status}</Tag>;
        }
      },
    },
    {
      title: 'SHA-256 (Xesh)',
      dataIndex: 'checksum',
      key: 'checksum',
      width: 105,
      render: (checksum?: string) =>
        checksum ? (
          <Tooltip content={checksum}>
            <Text code style={{ fontSize: 11, borderRadius: 0 }}>
              {checksum.slice(0, 10)}...
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
      width: 115,
      render: (val: string) => {
        if (!val) return '—';
        const d = new Date(val);
        const dateStr = d.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return (
          <div style={{ lineHeight: 1.35 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
              {timeStr}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Mas’ul Shaxs',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 155,
      render: (user?: BackupItem['triggeredBy']) =>
        user ? (
          <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{user.fullName}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Tizim (Rejali)</Text>
        ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 122,
      fixed: 'right' as const,
      render: (_: unknown, record: BackupItem) => (
        <TableActions
          onDelete={isSuperAdmin ? () => deleteMutation.mutate(record.id) : undefined}
          deleteConfirmTitle="Ushbu zaxira nusxasini o‘chirishni tasdiqlaysizmi?"
          deleteOkText="Ha, o‘chirilsin"
          deleteCancelText="Bekor qilish"
          deleteTooltip="O‘chirish"
          rightPadding={0}
          gap={6}
        >
          <Tooltip content="Yuklab olish">
            <Button
              size="small"
              type="secondary"
              icon={<IconCloudDownload />}
              onClick={() => backupsApi.downloadBackup(record.id, record.filename)}
              style={{ borderRadius: 0 }}
            />
          </Tooltip>

          <Tooltip content="Zaxiradan tiklash">
            <Button
              size="small"
              type="secondary"
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page Title & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
          <Button icon={<IconRefresh />} style={{ borderRadius: 0 }} onClick={handleRefresh}>
            Yangilash
          </Button>
          <Button
            type="primary"
            icon={<IconPlus />}
            style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
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
      <Row gutter={[16, 16]}>
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
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space size="medium" wrap>
            <Input
              allowClear
              prefix={<IconSearch />}
              placeholder="Fayl nomi yoki izoh bo‘yicha qidiruv..."
              style={{ width: 320, borderRadius: 0 }}
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
            />
            <Select
              style={{ width: 180, borderRadius: 0 }}
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
          </Space>
        </div>
      </Card>

      {/* Backups Table */}
      <StandardTable<BackupItem>
        rowKey="id"
        loading={isBackupsLoading || isStatsLoading}
        columns={columns}
        data={backupsData?.items || []}
        scrollX={1150}
        emptyText={
          search || backupType !== 'ALL'
            ? 'Qidiruv bo‘yicha zaxira nusxalari topilmadi'
            : 'Zaxira nusxalari mavjud emas'
        }
        pagination={{
          current: page,
          pageSize: pageSize,
          total: backupsData?.total || 0,
          onChange: (p, ps) => {
            setPage(p);
            if (ps) setPageSize(ps);
          },
        }}
      />

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
