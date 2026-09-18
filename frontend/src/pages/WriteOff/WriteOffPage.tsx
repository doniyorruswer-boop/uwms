import React, { useState, useMemo } from 'react';
import {
  Button,
  Tag,
  Badge,
  Space,
  Input,
  Modal,
  Form,
  Radio,
  Typography,
  Card,
  Grid,
  Alert,
  Empty,
  Drawer,
  Descriptions,
  Tabs,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconCheckCircle,
  IconCloseCircle,
  IconClockCircle,
  IconFile,
  IconDownload,
  IconRefresh,
  IconSafe,
  IconThumbUp,
  IconPrinter,
  IconEye,
} from '@arco-design/web-react/icon';
import { useWriteOffQuery, type WriteOffItem, type WriteOffMember } from '../../hooks/useWriteOffQuery';
import { CreateWriteOffModal } from '../../components/WriteOff/CreateWriteOffModal';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { useAuthStore } from '../../store/authStore';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
import { StandardTable } from '../../components/Common/StandardTable';
import { exportToExcel } from '../../utils/exportExcel';
import { TableActions } from '../../components/Common/TableActions';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const FormItem = Form.Item;
const { TextArea } = Input;
const TabPane = Tabs.TabPane;

export const WriteOffPage: React.FC = () => {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Voting modal state
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [selectedWriteOff, setSelectedWriteOff] = useState<WriteOffItem | null>(null);
  const [voteForm] = Form.useForm();

  // Passport Drawer state (opens on row click)
  const [isPassportDrawerVisible, setIsPassportDrawerVisible] = useState(false);
  const [selectedPassportItem, setSelectedPassportItem] = useState<WriteOffItem | null>(null);

  const handleOpenPassport = (record: WriteOffItem) => {
    setSelectedPassportItem(record);
    setIsPassportDrawerVisible(true);
  };

  // Official document modal state
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [activeDocData, setActiveDocData] = useState<any>(null);

  const { writeOffs, isLoading, isError, refetch, voteWriteOff, isVoting } = useWriteOffQuery({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  // Calculate high-level KPI metrics dynamically from real PostgreSQL records
  const totalCount = writeOffs.length;
  const inReviewCount = useMemo(
    () => writeOffs.filter((w) => w.status === 'IN_REVIEW').length,
    [writeOffs]
  );
  const approvedCount = useMemo(
    () => writeOffs.filter((w) => w.status === 'APPROVED').length,
    [writeOffs]
  );
  const rejectedCount = useMemo(
    () => writeOffs.filter((w) => w.status === 'REJECTED').length,
    [writeOffs]
  );
  const writtenOffBookValue = useMemo(
    () =>
      writeOffs
        .filter((w) => w.status === 'APPROVED')
        .reduce((sum, w) => sum + (w.asset.depreciation?.currentBookValue ?? w.asset.purchasePrice ?? 0), 0),
    [writeOffs]
  );

  const filteredWriteOffs = useMemo(() => {
    return writeOffs.filter((w) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        w.actNumber.toLowerCase().includes(q) ||
        w.asset.inventoryNumber.toLowerCase().includes(q) ||
        w.asset.item.name.toLowerCase().includes(q) ||
        w.reason.toLowerCase().includes(q)
      );
    });
  }, [writeOffs, search]);

  const handleOpenVote = (w: WriteOffItem) => {
    setSelectedWriteOff(w);
    voteForm.setFieldsValue({
      vote: 'APPROVED',
      comment: 'Texnik ekspertiza xulosasini to‘liq o‘rganib chiqdim. Hisobdan chiqarishga e’tirozim yo‘q.',
    });
    setVoteModalVisible(true);
  };

  const handleVoteSubmit = async () => {
    if (!selectedWriteOff) return;
    try {
      const values = await voteForm.validate();
      await voteWriteOff({
        id: selectedWriteOff.id,
        vote: values.vote,
        comment: values.comment,
      });
      setVoteModalVisible(false);
      setSelectedWriteOff(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDoc = (w: WriteOffItem) => {
    const item = {
      inventoryNumber: w.asset.inventoryNumber,
      name: w.asset.item.name,
      model: w.asset.item.model,
      serialNumber: w.asset.serialNumber,
      price: w.asset.purchasePrice || 0,
      quantity: 1,
      unit: 'dona',
    };

    setActiveDocData({
      docType: 'SPISANIE',
      docNumber: w.actNumber,
      date: (w.approvedAt || w.createdAt).substring(0, 10),
      sourceLocation: w.asset.room ? `${w.asset.room.number}-xona: ${w.asset.room.name}` : 'Kafedra',
      targetLocation: 'Hisobdan chiqarildi (Davlat reyestridan o‘chirildi)',
      senderName: w.createdBy?.fullName || 'Moddiy javobgar shaxs',
      receiverName: 'Universitet hisobdan chiqarish komissiyasi',
      items: [item],
      reason: `${w.reason}. Xulosa: ${w.technicalConclusion || ''}`,
    });
    setDocModalVisible(true);
  };

  const handleExportExcel = () => {
    const exportData = filteredWriteOffs.map((w) => ({
      'Dalolatnoma №': w.actNumber,
      'Asosiy Vosita': w.asset.item.name,
      'Inventar Raqami': w.asset.inventoryNumber,
      'Model': w.asset.item.model || '-',
      'Kategoriya': w.asset.item.category?.name || '-',
      'Xarid Narxi (so‘m)': w.asset.purchasePrice || 0,
      'Qoldiq Balans Qiymati (so‘m)': w.asset.depreciation?.currentBookValue ?? w.asset.purchasePrice ?? 0,
      'Hisobdan Chiqarish Sababi': w.reason,
      'Ekspertiza Xulosasi': w.technicalConclusion || '-',
      'Holati':
        w.status === 'APPROVED'
          ? 'Tasdiqlangan (OS-4)'
          : w.status === 'REJECTED'
          ? 'Rad Etilgan'
          : 'Komissiya Ko‘rigida',
      'Tasdiqlagan A’zolar': `${w.members.filter((m) => m.vote === 'APPROVED').length}/${w.members.length}`,
      'Ariza Sanasi': w.createdAt ? w.createdAt.substring(0, 10) : '-',
    }));
    exportToExcel(exportData, 'Spisanie_Hisobdan_Chiqarish_OS4');
  };

  const columns = [
    {
      title: 'Vosita & Dalolatnoma №',
      dataIndex: 'asset',
      width: 200,
      render: (_: any, record: WriteOffItem) => (
        <div style={{ paddingLeft: 8 }}>
          <CategoryThumbnail
            icon={<IconFile />}
            name={record.asset?.item?.name || 'Asosiy vosita'}
            subtitle={
              record.asset?.room
                ? `${record.asset.room.number}-xona`
                : record.asset?.inventoryNumber
                ? `Inv: ${record.asset.inventoryNumber}`
                : undefined
            }
            tag={record.actNumber}
            color="#F53F3F"
            bg="#FFECE8"
          />
        </div>
      ),
    },
    {
      title: 'Chiqarish Sababi & Qoldiq Qiymat',
      dataIndex: 'reason',
      minWidth: 220,
      render: (val: string, record: WriteOffItem) => {
        const bookVal = record.asset?.depreciation?.currentBookValue ?? record.asset?.purchasePrice ?? 0;
        return (
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-1)', lineHeight: 1.45, wordBreak: 'break-word' }}>
              {val}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--color-text-3)', flexWrap: 'wrap' }}>
              <span>Qoldiq qiymat: <b style={{ color: '#F53F3F' }}>{Number(bookVal).toLocaleString()} so‘m</b></span>
              {record.asset?.item?.category?.name ? (
                <span style={{ color: 'var(--color-text-3)' }}>• {record.asset.item.category.name}</span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Komissiya Ovozlari',
      dataIndex: 'members',
      width: 145,
      render: (members: WriteOffMember[]) => {
        const mApproved = members?.filter((m) => m.vote === 'APPROVED').length || 0;
        const mRejected = members?.filter((m) => m.vote === 'REJECTED').length || 0;
        const total = members?.length || 0;
        const percent = Math.round((mApproved / (total || 1)) * 100);

        return (
          <StockLevelGauge
            percent={percent}
            label={<span>Tasdiq: <b>{mApproved}/{total}</b></span>}
            subLabel={mRejected > 0 ? <span style={{ color: '#F53F3F', fontWeight: 600 }}>Rad: {mRejected}</span> : undefined}
            status={mRejected > 0 ? 'error' : percent === 100 ? 'success' : 'normal'}
            color={mRejected > 0 ? '#F53F3F' : percent === 100 ? '#00B42A' : '#165DFF'}
            size="small"
            strokeWidth={6}
            width={120}
          />
        );
      },
    },
    {
      title: 'Tashabbuskor & Sana',
      width: 140,
      render: (_: any, record: WriteOffItem) => (
        <div style={{ lineHeight: 1.35, maxWidth: 130 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={record.createdBy?.fullName || record.asset?.responsibleUser?.fullName || '—'}
          >
            {record.createdBy?.fullName || record.asset?.responsibleUser?.fullName || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2, whiteSpace: 'nowrap' }}>
            {record.createdAt?.substring(0, 10)}
          </div>
        </div>
      ),
    },
    {
      title: 'Bosqich',
      dataIndex: 'status',
      width: 165,
      render: (status: string) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {status === 'APPROVED' && <Badge status="success" text="Tasdiqlangan (OS-4)" />}
          {status === 'REJECTED' && <Badge status="error" text="Rad etilgan" />}
          {status !== 'APPROVED' && status !== 'REJECTED' && (
            <Badge status="processing" text="Komissiya ko‘rigida" />
          )}
        </div>
      ),
    },
    {
      title: 'Amallar',
      dataIndex: 'actions',
      width: 220,
      fixed: 'right' as const,


      render: (_: any, record: WriteOffItem) => {
        const isUserMember = record.members?.some((m) => m.userId === user?.id);
        const userVote = record.members?.find((m) => m.userId === user?.id);
        const hasVoted = userVote && userVote.vote !== 'PENDING';

        return (
          <TableActions rightPadding={0} gap={5}>
            <Button
              size="small"
              type="outline"
              icon={<IconEye />}
              style={{ borderRadius: 0, padding: '0 8px' }}
              onClick={(e) => {
                e?.stopPropagation?.();
                handleOpenPassport(record);
              }}
            >
              Pasport
            </Button>

            {record.status === 'IN_REVIEW' && isUserMember && !hasVoted ? (
              <Button
                type="primary"
                size="small"
                icon={<IconThumbUp />}
                style={{ borderRadius: 0, padding: '0 8px', backgroundColor: '#165DFF' }}
                onClick={(e) => {
                  e?.stopPropagation?.();
                  handleOpenVote(record);
                }}
              >
                Ovoz Berish
              </Button>
            ) : (
              <Button
                size="small"
                type="outline"
                icon={<IconPrinter />}
                style={{ borderRadius: 0, padding: '0 8px' }}
                onClick={(e) => {
                  e?.stopPropagation?.();
                  handleOpenDoc(record);
                }}
              >
                OS-4 Akti
              </Button>
            )}
          </TableActions>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs Filter */}
      <PageTabs
        activeTab={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { key: 'ALL', title: 'Barcha Holatlar', count: totalCount },
          {
            key: 'IN_REVIEW',
            title: 'Komissiya Ko‘rigida',
            count: inReviewCount,
          },
          {
            key: 'APPROVED',
            title: 'Tasdiqlangan (OS-4)',
            count: approvedCount,
          },
          {
            key: 'REJECTED',
            title: 'Rad Etilgan',
            count: rejectedCount,
          },
        ]}
      />

      {/* Actions Toolbar */}
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
              prefix={<IconSearch />}
              placeholder="Dalolatnoma №, inv № yoki sabab..."
              style={{ width: 320, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconRefresh />}
              style={{ borderRadius: 0 }}
              onClick={() => refetch()}
            >
              Yangilash
            </Button>
            <Button
              icon={<IconDownload />}
              style={{ borderRadius: 0 }}
              onClick={handleExportExcel}
            >
              Excel
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => setCreateModalVisible(true)}
            >
              Yangi Spisanie Talabnomasi
            </Button>
          </Space>
        </div>
      </Card>

      {/* Error State */}
      {isError && (
        <Alert
          type="error"
          title="Ma’lumotlarni yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzildi. Iltimos qayta urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()} style={{ borderRadius: 0 }}>
              Qayta Urinish
            </Button>
          }
        />
      )}

      {/* Universal Standard Table with Expandable Member Votes */}
      <StandardTable<WriteOffItem>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        data={filteredWriteOffs}
        scrollX={1120}
        onRowClick={(record) => handleOpenPassport(record)}
        emptyText={
          search
            ? `«${search}» bo‘yicha hisobdan chiqarish arizalari topilmadi`
            : 'Hisobdan chiqarish dalolatnomalari mavjud emas'
        }
        expandedRowRender={(record: WriteOffItem) => (
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, backgroundColor: 'var(--color-fill-1)', border: 'none' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--color-text-1)' }}>
              Davlat Hisobdan Chiqarish Komissiyasi A’zolarining Xulosalari va Ovozlar Reyestri:
            </div>
            <Row gutter={[12, 12]}>
              {record.members.map((m) => {
                let badgeColor = 'orange';
                let badgeText = 'Kutilmoqda';
                if (m.vote === 'APPROVED') {
                  badgeColor = 'green';
                  badgeText = 'Ma’qullandi';
                } else if (m.vote === 'REJECTED') {
                  badgeColor = 'red';
                  badgeText = 'Rad etildi';
                }

                return (
                  <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
                    <Card
                      style={{
                        borderRadius: 0,
                        backgroundColor: 'var(--color-bg-2)',
                        border: '1px solid var(--color-border-2)',
                      }}
                      bodyStyle={{ padding: '12px 14px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Tag color={badgeColor} style={{ borderRadius: 0, fontSize: 11 }}>
                          {badgeText}
                        </Tag>
                        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{m.roleName}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>
                        {m.user?.fullName}
                      </div>
                      {m.comment && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-2)',
                            marginTop: 6,
                            fontStyle: 'italic',
                          }}
                        >
                          «{m.comment}»
                        </div>
                      )}
                      {m.votedAt && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 4 }}>
                          Sana: {m.votedAt.replace('T', ' ').substring(0, 16)}
                        </div>
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}
      />

      {/* Create Modal */}
      <CreateWriteOffModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />

      {/* Voting Modal */}
      <Modal
        title={
          <Space>
            <IconThumbUp style={{ color: '#165DFF' }} />
            <span>Komissiya A’zosi Sifatida Elektron Ovoz Berish</span>
          </Space>
        }
        visible={voteModalVisible}
        onCancel={() => setVoteModalVisible(false)}
        style={{ width: 560, borderRadius: 0 }}
        footer={
          <Space>
            <Button onClick={() => setVoteModalVisible(false)} style={{ borderRadius: 0 }}>
              Bekor Qilish
            </Button>
            <Button
              type="primary"
              loading={isVoting}
              onClick={handleVoteSubmit}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
            >
              Ovozni Tasdiqlash
            </Button>
          </Space>
        }
      >
        {selectedWriteOff && (
          <div style={{ marginBottom: 16 }}>
            <Card className="uwms-card" style={{ borderRadius: 0, backgroundColor: 'var(--color-fill-1)' }} bodyStyle={{ padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Dalolatnoma: {selectedWriteOff.actNumber}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Asosiy Vosita: <b>{selectedWriteOff.asset.item.name}</b> (Inv: {selectedWriteOff.asset.inventoryNumber})
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                Sabab: {selectedWriteOff.reason}
              </div>
            </Card>
          </div>
        )}

        <Form form={voteForm} layout="vertical">
          <FormItem
            label="Sizning Qaroringiz"
            field="vote"
            rules={[{ required: true, message: 'Qarorni tanlang' }]}
          >
            <Radio.Group type="button">
              <Radio value="APPROVED">Hisobdan Chiqarishni Tasdiqlayman</Radio>
              <Radio value="REJECTED">E’tirozim Bor (Rad Etaman)</Radio>
            </Radio.Group>
          </FormItem>

          <FormItem label="Ekspert Xulosasi / Izoh" field="comment">
            <TextArea
              rows={3}
              placeholder="Qaroringiz bo‘yicha daliliy izoh yoki qo‘shimcha fikringizni yozing..."
              style={{ borderRadius: 0 }}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* Official OS-4 Document Modal */}
      {activeDocData && (
        <OfficialDocModal
          visible={docModalVisible}
          onClose={() => {
            setDocModalVisible(false);
            setActiveDocData(null);
          }}
          {...activeDocData}
        />
      )}

      {/* ASSET PASSPORT DRAWER (Opens on row click) */}
      <Drawer
        width={560}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {selectedPassportItem?.asset.inventoryNumber || 'Asosiy Vosita Pasporti'}
            </span>
            {selectedPassportItem && (
              <Tag
                color={
                  selectedPassportItem.status === 'APPROVED'
                    ? 'green'
                    : selectedPassportItem.status === 'REJECTED'
                    ? 'red'
                    : 'orange'
                }
                style={{ borderRadius: 0 }}
              >
                {selectedPassportItem.status === 'APPROVED'
                  ? 'Tasdiqlangan (OS-4)'
                  : selectedPassportItem.status === 'REJECTED'
                  ? 'Rad Etilgan'
                  : 'Komissiya Ko‘rigida'}
              </Tag>
            )}
          </div>
        }
        visible={isPassportDrawerVisible}
        onCancel={() => setIsPassportDrawerVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button
              type="outline"
              icon={<IconPrinter />}
              style={{ borderRadius: 0 }}
              onClick={() => {
                if (selectedPassportItem) {
                  handleOpenDoc(selectedPassportItem);
                }
              }}
            >
              OS-4 Aktini Ko‘rish
            </Button>
            <Button
              type="primary"
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => setIsPassportDrawerVisible(false)}
            >
              Yopish
            </Button>
          </div>
        }
      >
        {selectedPassportItem && (
          <Tabs defaultActiveTab="passport">
            <TabPane key="passport" title="Asosiy Pasport">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    { label: 'Jihoz Nomi', value: selectedPassportItem.asset.item.name },
                    { label: 'Model / Modifikatsiya', value: selectedPassportItem.asset.item.model || 'Standart' },
                    { label: 'Kategoriya', value: selectedPassportItem.asset.item.category?.name || 'Asosiy vositalar' },
                    {
                      label: 'Inventar Raqami',
                      value: <b style={{ color: '#165DFF' }}>{selectedPassportItem.asset.inventoryNumber}</b>,
                    },
                    { label: 'Seriya Raqami (SN)', value: selectedPassportItem.asset.serialNumber || 'Mavjud emas' },
                    {
                      label: 'Hozirgi Xonasi',
                      value: selectedPassportItem.asset.room
                        ? `${selectedPassportItem.asset.room.number}-xona: ${selectedPassportItem.asset.room.name}`
                        : 'Markaziy Ombor',
                    },
                    {
                      label: 'Moddiy Mas’ul Shaxs',
                      value: selectedPassportItem.asset.responsibleUser?.fullName || 'Bosh omborchi',
                    },
                    {
                      label: 'Moliyalashtirish Manbasi',
                      value: (
                        <Tag color="arcoblue" size="small" style={{ borderRadius: 0 }}>
                          {selectedPassportItem.asset.fundingSource || 'BYUDJET'}
                        </Tag>
                      ),
                    },
                    {
                      label: 'Boshlang‘ich Balans Narxi',
                      value: `${Number(selectedPassportItem.asset.purchasePrice || 0).toLocaleString('uz-UZ')} so‘m`,
                    },
                    {
                      label: 'Hozirgi Qoldiq Qiymati',
                      value: (
                        <b style={{ color: '#FF7D00' }}>
                          {Number(
                            selectedPassportItem.asset.depreciation?.currentBookValue ??
                            selectedPassportItem.asset.purchasePrice ??
                            0
                          ).toLocaleString('uz-UZ')}{' '}
                          so‘m
                        </b>
                      ),
                    },
                  ]}
                />
              </div>
            </TabPane>

            <TabPane key="writeoff" title="Spisanie & Ekspertiza">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    {
                      label: 'Dalolatnoma Raqami',
                      value: (
                        <b style={{ color: '#F53F3F', fontFamily: 'monospace' }}>
                          {selectedPassportItem.actNumber}
                        </b>
                      ),
                    },
                    { label: 'Hisobdan Chiqarish Sababi', value: selectedPassportItem.reason },
                    {
                      label: 'Texnik Ekspertiza Xulosasi',
                      value: (
                        <div style={{ color: 'var(--color-text-1)', lineHeight: 1.5 }}>
                          {selectedPassportItem.technicalConclusion || 'Ekspertiza xulosasi kiritilmagan'}
                        </div>
                      ),
                    },
                    {
                      label: 'Ariza Berilgan Sana',
                      value: selectedPassportItem.createdAt ? selectedPassportItem.createdAt.substring(0, 10) : '—',
                    },
                    {
                      label: 'Tashabbuskor (Talabgor)',
                      value: `${selectedPassportItem.createdBy?.fullName} (${selectedPassportItem.createdBy?.role})`,
                    },
                  ]}
                />
              </div>
            </TabPane>

            <TabPane key="commission" title={`Komissiya Ovozlari (${selectedPassportItem.members.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                {selectedPassportItem.members.map((m) => {
                  let badgeColor = 'orange';
                  let voteText = 'Kutilmoqda';
                  if (m.vote === 'APPROVED') {
                    badgeColor = 'green';
                    voteText = 'Tasdiqlagan';
                  } else if (m.vote === 'REJECTED') {
                    badgeColor = 'red';
                    voteText = 'Rad etgan';
                  }
                  return (
                    <Card
                      key={m.id}
                      className="uwms-card"
                      style={{ borderRadius: 0, border: '1px solid var(--color-border-2)' }}
                      bodyStyle={{ padding: '10px 14px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <b style={{ fontSize: 13 }}>{m.user.fullName}</b>
                          <span style={{ fontSize: 12, color: 'var(--color-text-3)', marginLeft: 8 }}>
                            ({m.roleName})
                          </span>
                        </div>
                        <Tag color={badgeColor} size="small" style={{ borderRadius: 0 }}>
                          {voteText}
                        </Tag>
                      </div>
                      {m.comment && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-2)',
                            backgroundColor: 'var(--color-fill-2)',
                            padding: '6px 8px',
                            marginTop: 6,
                          }}
                        >
                          «{m.comment}»
                        </div>
                      )}
                      {m.votedAt && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 4 }}>
                          Sana: {m.votedAt.replace('T', ' ').substring(0, 16)}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </TabPane>
          </Tabs>
        )}
      </Drawer>
    </div>
  );
};
