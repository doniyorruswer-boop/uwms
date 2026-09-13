import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  Form,
  Radio,
  Typography,
  Card,
  Progress,
  Grid,
  Alert,
  Empty,
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
} from '@arco-design/web-react/icon';
import { useWriteOffQuery, type WriteOffItem, type WriteOffMember } from '../../hooks/useWriteOffQuery';
import { CreateWriteOffModal } from '../../components/WriteOff/CreateWriteOffModal';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { useAuthStore } from '../../store/authStore';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { exportToExcel } from '../../utils/exportExcel';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const FormItem = Form.Item;
const { TextArea } = Input;

export const WriteOffPage: React.FC = () => {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Voting modal state
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [selectedWriteOff, setSelectedWriteOff] = useState<WriteOffItem | null>(null);
  const [voteForm] = Form.useForm();

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
      title: 'Dalolatnoma №',
      dataIndex: 'actNumber',
      width: 150,
      render: (val: string) => (
        <span style={{ fontWeight: 700, color: '#F53F3F', fontFamily: 'monospace', fontSize: 13 }}>
          {val}
        </span>
      ),
    },
    {
      title: 'Asosiy Vosita',
      dataIndex: 'asset',
      width: 280,
      render: (_: any, record: WriteOffItem) => {
        const bookVal = record.asset.depreciation?.currentBookValue ?? record.asset.purchasePrice;
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <CategoryThumbnail
              icon={<IconFile />}
              name={record.asset.item.name}
              subtitle={`Inv: ${record.asset.inventoryNumber}${record.asset.item.model ? ` | ${record.asset.item.model}` : ''}`}
              tag={record.asset.item.category?.name || 'Asosiy vosita'}
              color="#F53F3F"
              bg="#FFECE8"
            />
            {bookVal !== undefined && (
              <div style={{ fontSize: 11, color: '#86909C', paddingLeft: 50 }}>
                Balans qiymati: <b>{bookVal.toLocaleString('uz-UZ')} so‘m</b>
              </div>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Sabab & Xulosa',
      dataIndex: 'reason',
      width: 260,
      render: (val: string, record: WriteOffItem) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
          {record.technicalConclusion && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
              <span style={{ color: '#FF7D00', fontWeight: 600 }}>Ekspertiza:</span> {record.technicalConclusion}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Komissiya Ovozlari',
      dataIndex: 'members',
      width: 190,
      render: (members: WriteOffMember[]) => {
        const mApproved = members.filter((m) => m.vote === 'APPROVED').length;
        const mRejected = members.filter((m) => m.vote === 'REJECTED').length;
        const total = members.length;
        const percent = Math.round((mApproved / (total || 1)) * 100);

        return (
          <div style={{ width: 170 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>Tasdiq: <b>{mApproved}/{total}</b></span>
              {mRejected > 0 && <span style={{ color: '#F53F3F', fontWeight: 600 }}>Rad: {mRejected}</span>}
            </div>
            <Progress
              percent={percent}
              status={mRejected > 0 ? 'error' : percent === 100 ? 'success' : 'normal'}
              size="small"
              style={{ width: '100%' }}
            />
          </div>
        );
      },
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      width: 160,
      render: (status: string) => {
        if (status === 'APPROVED') {
          return (
            <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
              Tasdiqlangan (OS-4)
            </Tag>
          );
        }
        if (status === 'REJECTED') {
          return (
            <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
              Rad Etilgan
            </Tag>
          );
        }
        return (
          <Tag color="orange" icon={<IconClockCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
            Komissiya Ko‘rigida
          </Tag>
        );
      },
    },
    {
      title: 'Sana',
      dataIndex: 'createdAt',
      width: 110,
      render: (val: string) => (val ? val.substring(0, 10) : '-'),
    },
    {
      title: 'Amallar',
      dataIndex: 'actions',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: WriteOffItem) => {
        const isUserMember = record.members.some((m) => m.userId === user?.id);
        const userVote = record.members.find((m) => m.userId === user?.id);
        const hasVoted = userVote && userVote.vote !== 'PENDING';

        return (
          <div style={{ paddingRight: 8, display: 'flex', alignItems: 'center' }}>
            <Space size="small">
            {record.status === 'IN_REVIEW' && isUserMember && !hasVoted && (
              <Button
                type="primary"
                size="small"
                style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                onClick={() => handleOpenVote(record)}
              >
                Ovoz Berish
              </Button>
            )}

            <Button
              size="small"
              icon={<IconPrinter />}
              style={{ borderRadius: 0 }}
              onClick={() => handleOpenDoc(record)}
            >
              OS-4 Akti
            </Button>
          </Space>
        </div>
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

      {/* Table with Expandable Member Votes */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          data={filteredWriteOffs}
          scroll={{ x: 1330 }}
          pagination={{
            pageSize: 10,
            sizeCanChange: true,
            sizeOptions: [10, 20, 50, 100],
            showTotal: (total, range) => {
              if (!total || total === 0) return '0/0';
              const to = range ? Math.min(range[1], total) : total;
              return `${to}/${total}`;
            },
          }}
          style={{ borderRadius: 0 }}
          noDataElement={
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Empty
                description={
                  search
                    ? `«${search}» bo‘yicha hisobdan chiqarish arizalari topilmadi`
                    : 'Hisobdan chiqarish dalolatnomalari mavjud emas'
                }
              />
            </div>
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
                  let voteText = 'Kutilmoqda';
                  if (m.vote === 'APPROVED') {
                    badgeColor = 'green';
                    voteText = 'Tasdiqlagan';
                  } else if (m.vote === 'REJECTED') {
                    badgeColor = 'red';
                    voteText = 'Rad etgan';
                  }

                  return (
                    <Col key={m.id} xs={24} sm={12} md={8}>
                      <Card
                        className="uwms-card"
                        style={{ borderRadius: 0, border: '1px solid var(--color-border-2)' }}
                        bodyStyle={{ padding: '12px 14px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <b style={{ fontSize: 13 }}>{m.user.fullName}</b>
                          <Tag color={badgeColor} size="small" style={{ borderRadius: 0 }}>
                            {voteText}
                          </Tag>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          Vazifasi: <i>{m.roleName}</i>
                        </div>
                        {m.comment && (
                          <div
                            style={{
                              fontSize: 12,
                              marginTop: 6,
                              color: 'var(--color-text-2)',
                              backgroundColor: 'var(--color-fill-2)',
                              padding: '6px 8px',
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
      </Card>

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
    </div>
  );
};
