import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Grid,
  Select,
  Button,
  Input,
  Space,
  Tag,
  Alert,
  Table,
  Message,
  Notification,
  Popconfirm,
  Switch,
  Typography,
  Empty,
  Badge,
  Spin,
} from '@arco-design/web-react';
import {
  IconScan,
  IconCheckCircle,
  IconCloseCircle,
  IconExclamationCircle,
  IconDownload,
  IconRefresh,
  IconSound,
  IconCamera,
  IconStop,
  IconFile,
  IconCalendar,
  IconMobile,
  IconDesktop,
  IconWifi,
  IconSync,
  IconCalendarClock,
} from '@arco-design/web-react/icon';
import { Html5Qrcode } from 'html5-qrcode';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useAuditsQuery, useAuditDetailQuery } from '../../hooks/useAuditsQuery';
import { useAuditCampaignsQuery } from '../../hooks/useAuditCampaignsQuery';
import { useSocket } from '../../hooks/useSocket';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { useAuthStore } from '../../store/authStore';
import type { ItemInstance } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { playScannerBeep } from '../../utils/audio';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

export const AuditScannerPage: React.FC = () => {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const campaignIdParam = searchParams.get('campaignId') || '';
  const roomIdParam = searchParams.get('roomId') || '';

  const { assets } = useAssetsQuery();
  const { rooms } = useOrganizationQuery();
  const { scanCode, batchScan, completeAudit, isCompleting, audits } = useAuditsQuery();
  const { data: campaigns = [] } = useAuditCampaignsQuery();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignIdParam);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(roomIdParam);

  useEffect(() => {
    if (roomIdParam) setSelectedRoomId(roomIdParam);
    if (campaignIdParam) setSelectedCampaignId(campaignIdParam);
  }, [roomIdParam, campaignIdParam]);

  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Phase I: Mobile Layout & Offline Queue State
  const OFFLINE_QUEUE_KEY = 'uwms_audit_offline_queue';
  const [offlineQueue, setOfflineQueue] = useState<Array<{
    id: string;
    qrCode: string;
    roomId: string;
    campaignId?: string;
    timestamp: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isMobileView, setIsMobileView] = useState<boolean>(() => window.innerWidth <= 840);
  const [recentScans, setRecentScans] = useState<Array<{
    id: string;
    qrCode: string;
    inventoryNumber: string;
    itemName: string;
    roomStatus: 'MATCHED' | 'RELOCATED' | 'UNKNOWN';
    scannedAt: string;
    isOffline?: boolean;
  }>>([]);

  // Auto-detect online/offline & resize
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      Message.info('Internet aloqasi tiklandi. Oflayn navbat sinxronlanmoqda...');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      Message.warning('Internet aloqasi uzildi. Skanlar oflayn xotiraga saqlanadi.');
    };
    const handleResize = () => {
      if (window.innerWidth <= 840) {
        setIsMobileView(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch (e) {
      console.error('Failed to save offline queue', e);
    }
  }, [offlineQueue]);

  const syncOfflineQueue = async () => {
    const currentQueue = (() => {
      try {
        const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    })();

    if (!currentQueue || currentQueue.length === 0) {
      Message.info('Sinxronlash uchun oflayn skanlar mavjud emas.');
      return;
    }
    if (!navigator.onLine) {
      Message.warning('Hozirda oflayn rejimdasiz. Internetga ulaning.');
      return;
    }

    setIsSyncing(true);
    try {
      const itemsPayload = currentQueue.map((item: any) => ({
        roomId: item.roomId,
        qrCode: item.qrCode,
        campaignId: item.campaignId,
      }));

      const res = await batchScan(itemsPayload);

      if (res && res.auditIds && res.auditIds.length > 0) {
        setActiveAuditId(res.auditIds[0]);
      }

      setOfflineQueue([]);
      localStorage.removeItem(OFFLINE_QUEUE_KEY);

      setRecentScans((prev) =>
        prev.map((r) => ({ ...r, isOffline: false }))
      );

      Message.success(
        `Tranzaksion sinxronlandi: Jami ${res.processed} ta skandan ${res.matched} tasi o‘z xonasida topildi, ${res.relocated} tasi boshqa xonadan!`
      );
      await refetchAuditDetail();
    } catch (err: any) {
      Message.error(err.response?.data?.message || 'Oflayn skanlarni tranzaksion yuborishda xatolik yuz berdi!');
    } finally {
      setIsSyncing(false);
    }
  };

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const activeRoom = selectedRoomId || (rooms.length > 0 ? rooms[0].id : '');
  const currentRoom = rooms.find((r) => r.id === activeRoom);

  // Check active room audit from audits list or activeAuditId
  const roomAuditSummary = useMemo(() => {
    return audits.find((a) => a.roomId === activeRoom || a.roomNumber === currentRoom?.number);
  }, [audits, activeRoom, currentRoom]);

  const currentAuditId = activeAuditId || roomAuditSummary?.id || null;
  const { data: auditDetail, refetch: refetchAuditDetail } = useAuditDetailQuery(currentAuditId);

  // Real-Time Multi-Auditor Sync & Collision Guard Socket Integration
  const { socket, isConnected: isSocketConnected, joinRoom, leaveRoom } = useSocket();
  const [collisionAlert, setCollisionAlert] = useState<{
    previousRoomNumber?: string;
    previousRoomName?: string;
    minutesAgo?: number;
    message?: string;
  } | null>(null);

  // Join campaign and room socket rooms
  useEffect(() => {
    if (!socket || !isSocketConnected) return;

    if (selectedCampaignId) {
      joinRoom(`campaign:${selectedCampaignId}`);
    }
    if (activeRoom) {
      joinRoom(`room:${activeRoom}`);
    }

    return () => {
      if (selectedCampaignId) {
        leaveRoom(`campaign:${selectedCampaignId}`);
      }
      if (activeRoom) {
        leaveRoom(`room:${activeRoom}`);
      }
    };
  }, [socket, isSocketConnected, selectedCampaignId, activeRoom, joinRoom, leaveRoom]);

  // Real-Time Sync: Listen for remote scans and collision guard events
  useEffect(() => {
    if (!socket) return;

    const handleAssetScanned = (payload: any) => {
      if (payload?.roomId === activeRoom) {
        const scannedQr = payload?.asset?.qrCode;
        if (scannedQr) {
          setScannedCodes((prev) => (prev.includes(scannedQr) ? prev : [...prev, scannedQr]));
        }

        Message.info({
          content: `Auditor jihozni skanerladi: ${payload.asset.itemName} (${payload.asset.inventoryNumber})`,
          icon: <IconCheckCircle style={{ color: '#00B42A' }} />,
        });

        if (soundEnabled) {
          playScannerBeep();
        }

        setRecentScans((prev) => {
          if (prev.some((p) => p.qrCode === scannedQr)) return prev;
          return [
            {
              id: `${Date.now()}-${Math.random()}`,
              qrCode: scannedQr,
              inventoryNumber: payload.asset.inventoryNumber,
              itemName: payload.asset.itemName,
              roomStatus: payload.status,
              scannedAt: new Date(payload.scannedAt).toLocaleTimeString('uz-UZ'),
              isOffline: false,
            },
            ...prev.slice(0, 4),
          ];
        });

        refetchAuditDetail();
      }

      // To'qnashuv hodisasi
      if (payload?.collision?.detected) {
        Notification.warning({
          title: 'To‘qnashuv aniqlandi! (Collision Guard)',
          content: payload.collision.message,
          duration: 7,
        });
        setCollisionAlert(payload.collision);
      }
    };

    const handleCollisionDetected = (payload: any) => {
      if (payload?.collision?.detected) {
        Notification.warning({
          title: '⚠️ To‘qnashuv aniqlandi!',
          content: payload.collision.message,
          duration: 8,
        });
        setCollisionAlert(payload.collision);
      }
    };

    socket.on('audit:asset_scanned', handleAssetScanned);
    socket.on('audit:collision_detected', handleCollisionDetected);

    return () => {
      socket.off('audit:asset_scanned', handleAssetScanned);
      socket.off('audit:collision_detected', handleCollisionDetected);
    };
  }, [socket, activeRoom, soundEnabled, refetchAuditDetail]);

  // Expected assets in this room
  const expectedAssets = useMemo(() => {
    return assets.filter((a) => a.roomId === activeRoom);
  }, [assets, activeRoom]);

  // Real database-backed records when audit exists in backend
  const matchedAssets = useMemo(() => {
    if (auditDetail?.records && auditDetail.records.length > 0) {
      return auditDetail.records
        .filter((r: any) => r.status === 'MATCHED')
        .map((r: any) => ({
          ...r.itemInstance,
          itemName: r.itemInstance?.item?.name || r.itemInstance?.itemName,
          itemModel: r.itemInstance?.item?.model || r.itemInstance?.itemModel,
          purchasePrice: r.itemInstance?.purchasePrice ? Number(r.itemInstance.purchasePrice) : 0,
        }));
    }
    return expectedAssets.filter((a) => scannedCodes.includes(a.qrCode));
  }, [auditDetail, expectedAssets, scannedCodes]);

  const missingAssets = useMemo(() => {
    if (auditDetail?.records && auditDetail.records.length > 0) {
      return auditDetail.records
        .filter((r: any) => r.status === 'MISSING')
        .map((r: any) => ({
          ...r.itemInstance,
          itemName: r.itemInstance?.item?.name || r.itemInstance?.itemName,
          itemModel: r.itemInstance?.item?.model || r.itemInstance?.itemModel,
          purchasePrice: r.itemInstance?.purchasePrice ? Number(r.itemInstance.purchasePrice) : 0,
        }));
    }
    return expectedAssets.filter((a) => !scannedCodes.includes(a.qrCode));
  }, [auditDetail, expectedAssets, scannedCodes]);

  const unexpectedAssets = useMemo(() => {
    if (auditDetail?.records && auditDetail.records.length > 0) {
      return auditDetail.records
        .filter((r: any) => r.status === 'RELOCATED')
        .map((r: any) => ({
          ...r.itemInstance,
          itemName: r.itemInstance?.item?.name || r.itemInstance?.itemName,
          itemModel: r.itemInstance?.item?.model || r.itemInstance?.itemModel,
          purchasePrice: r.itemInstance?.purchasePrice ? Number(r.itemInstance.purchasePrice) : 0,
        }));
    }
    return assets.filter(
      (a) => a.roomId !== activeRoom && scannedCodes.includes(a.qrCode)
    );
  }, [auditDetail, assets, activeRoom, scannedCodes]);

  const completionPercent = useMemo(() => {
    if (auditDetail?.records && expectedAssets.length > 0) {
      const matchedCount = auditDetail.records.filter((r: any) => r.status === 'MATCHED').length;
      return Math.round((matchedCount / expectedAssets.length) * 100);
    }
    return expectedAssets.length > 0
      ? Math.round((matchedAssets.length / expectedAssets.length) * 100)
      : 0;
  }, [auditDetail, expectedAssets, matchedAssets]);

  // Camera detection & initialization
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setAvailableCameras(devices);
            const backCam = devices.find((d) => /back|rear|environment/i.test(d.label));
            if (isMobileView && backCam) {
              setSelectedCameraId(backCam.id);
            } else {
              setSelectedCameraId(devices[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isMobileView]);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Message.warning('Brauzeringizda video kamera oqimi qo‘llab-quvvatlanmaydi (HTTPS xavfsiz ulanish talab etiladi).');
        return;
      }

      setCameraLoading(true);
      setIsCameraRunning(true);

      // Brief delay to allow React to render the reader container in the DOM with real dimensions
      await new Promise((resolve) => setTimeout(resolve, 150));

      const readerElem = document.getElementById('audit-qr-reader');
      if (!readerElem) {
        setIsCameraRunning(false);
        setCameraLoading(false);
        Message.warning('Skanerlash oynasi topilmadi.');
        return;
      }

      const html5QrCode = new Html5Qrcode('audit-qr-reader');
      scannerRef.current = html5QrCode;

      // Camera config: if selectedCameraId is set, use it; otherwise environment on mobile / user on desktop
      const cameraConfig: any = selectedCameraId
        ? selectedCameraId
        : isMobileView
        ? { facingMode: 'environment' }
        : availableCameras[0]?.id || { facingMode: 'user' };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {}
      );
      Message.success('Kamera muvaffaqiyatli ishga tushirildi');
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsCameraRunning(false);
      Message.warning('Kamerani ochib bo‘lmadi (qurilma band yoki ruxsat yo‘q). Shtrix-kod skaneri yoki qo‘lda kiritishdan foydalaning.');
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      console.warn('Camera stop warning:', err);
    } finally {
      setIsCameraRunning(false);
      Message.info('Kamera to‘xtatildi');
    }
  };

  const handleToggleView = async (nextView: boolean) => {
    if (isCameraRunning && scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsCameraRunning(false);
    }
    setIsMobileView(nextView);
  };

  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    if (scannedCodes.includes(trimmed)) {
      Message.warning('Ushbu QR kod avvalroq o‘qilgan!');
      return;
    }

    try {
      if (soundEnabled) {
        playScannerBeep();
      }

      setScannedCodes((prev) => [...prev, trimmed]);

      // Verify asset in room
      const foundInRoom = expectedAssets.find((a) => a.qrCode === trimmed);
      const foundElsewhere = assets.find((a) => a.qrCode === trimmed);

      let status: 'MATCHED' | 'RELOCATED' | 'UNKNOWN' = 'UNKNOWN';
      let assetName = 'Noma’lum aktiv';
      let invNumber = trimmed;

      if (foundInRoom) {
        status = 'MATCHED';
        assetName = foundInRoom.itemName;
        invNumber = foundInRoom.inventoryNumber;
        Message.success(`Topildi: ${foundInRoom.itemName} (${foundInRoom.inventoryNumber})`);
      } else if (foundElsewhere) {
        status = 'RELOCATED';
        assetName = foundElsewhere.itemName;
        invNumber = foundElsewhere.inventoryNumber;
        Message.warning(`Diqqat! Ushbu uskuna boshqa xonaga tegishli: ${foundElsewhere.itemName}`);
      } else {
        Message.info(`Noma’lum kod: ${trimmed}`);
      }

      // Offline detection & queue
      if (!navigator.onLine) {
        const offlineRecord = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `offline-${Date.now()}-${offlineQueue.length + 1}`),
          qrCode: trimmed,
          roomId: activeRoom,
          campaignId: selectedCampaignId || undefined,
          timestamp: Date.now(),
        };
        setOfflineQueue((prev) => [...prev, offlineRecord]);
        setRecentScans((prev) => [
          {
            id: `${Date.now()}`,
            qrCode: trimmed,
            inventoryNumber: invNumber,
            itemName: assetName,
            roomStatus: status,
            scannedAt: new Date().toLocaleTimeString('uz-UZ'),
            isOffline: true,
          },
          ...prev.slice(0, 4),
        ]);
        Message.info('Tarmoq yo‘q. Skan offline navbatga saqlandi.');
        setManualCode('');
        return;
      }

      // Online scan attempt
      try {
        const scanRes = await scanCode({
          qrCode: trimmed,
          roomId: activeRoom,
          campaignId: selectedCampaignId || undefined,
        });
        if (scanRes && scanRes.auditId) {
          setActiveAuditId(scanRes.auditId);
        }

        // Collision Guard (To'qnashuv) tekshiruvi natijasi
        if (scanRes?.collision?.detected) {
          Notification.warning({
            title: '⚠️ To‘qnashuv aniqlandi! (Collision Guard)',
            content: scanRes.collision.message,
            duration: 8,
          });
          setCollisionAlert(scanRes.collision);
        } else {
          setCollisionAlert(null);
        }

        await refetchAuditDetail();

        setRecentScans((prev) => [
          {
            id: `${Date.now()}`,
            qrCode: trimmed,
            inventoryNumber: invNumber,
            itemName: assetName,
            roomStatus: status,
            scannedAt: new Date().toLocaleTimeString('uz-UZ'),
            isOffline: false,
          },
          ...prev.slice(0, 4),
        ]);
      } catch {
        // Network failure fallback to offline queue
        const offlineRecord = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `offline-${Date.now()}-${offlineQueue.length + 1}`),
          qrCode: trimmed,
          roomId: activeRoom,
          campaignId: selectedCampaignId || undefined,
          timestamp: Date.now(),
        };
        setOfflineQueue((prev) => [...prev, offlineRecord]);
        setRecentScans((prev) => [
          {
            id: `${Date.now()}`,
            qrCode: trimmed,
            inventoryNumber: invNumber,
            itemName: assetName,
            roomStatus: status,
            scannedAt: new Date().toLocaleTimeString('uz-UZ'),
            isOffline: true,
          },
          ...prev.slice(0, 4),
        ]);
        Message.info('Serverga ulanib bo‘lmadi. Skan offline navbatga saqlandi.');
      }
      setManualCode('');
    } catch (err: any) {
      Message.error(err.response?.data?.message || 'Skanerlashda xatolik yuz berdi!');
    }
  };

  const handleCompleteAudit = async () => {
    if (!currentAuditId) {
      Message.warning('Hali birorta ham uskuna skanerlanmadi yoki faol audit sessiyasi topilmadi!');
      return;
    }
    try {
      await completeAudit({
        auditId: currentAuditId,
        notes: `${currentRoom?.name || 'Xona'} inventarizatsiyasi yakunlandi. Kamomadlar qayd etildi.`,
      });
      setIsCompleted(true);
      await refetchAuditDetail();
      setIsDocModalVisible(true);
    } catch {
      // Handled by onError in useAuditsQuery
    }
  };

  const handleResetAudit = () => {
    setScannedCodes([]);
    setActiveAuditId(null);
    setIsCompleted(false);
    Message.info('Inventarizatsiya qayta boshlandi.');
  };

  const handleExportAuditExcel = () => {
    const reportData = [
      ...matchedAssets.map((a) => ({
        'Inventar №': a.inventoryNumber,
        'Nomi': a.itemName,
        'Model': a.itemModel || '',
        'Kutilgan Xona': currentRoom?.name || '',
        'Audit Natijasi': 'TOPILDI (Mavjud)',
        'Mas’ul Shaxs': a.responsibleUserName || '',
      })),
      ...missingAssets.map((a) => ({
        'Inventar №': a.inventoryNumber,
        'Nomi': a.itemName,
        'Model': a.itemModel || '',
        'Kutilgan Xona': currentRoom?.name || '',
        'Audit Natijasi': 'KAMOMAD (Topilmadi)',
        'Mas’ul Shaxs': a.responsibleUserName || '',
      })),
      ...unexpectedAssets.map((a) => ({
        'Inventar №': a.inventoryNumber,
        'Nomi': a.itemName,
        'Model': a.itemModel || '',
        'Kutilgan Xona': a.roomName || 'Boshqa xona',
        'Audit Natijasi': 'BEGONA XONADAN TOPILDI',
        'Mas’ul Shaxs': a.responsibleUserName || '',
      })),
    ];

    exportToExcel(
      reportData,
      `Audit_${currentRoom?.number || 'xona'}_Dalolatnomasi`,
      'Inventarizatsiya Dalolatnomasi'
    );
    Message.success('Audit dalolatnomasi Excel faylga yuklandi!');
  };

  const auditDocItems = useMemo(() => {
    if (auditDetail?.records && auditDetail.records.length > 0) {
      return auditDetail.records.map((r: any) => {
        const tag =
          r.status === 'MATCHED'
            ? '[TOPILDI - MAVJUD]'
            : r.status === 'MISSING'
              ? '[KAMOMAD / TOPILMADI]'
              : r.status === 'RELOCATED'
                ? `[BEGONA XONADAN: ${r.itemInstance?.room?.name || 'Boshqa joy'}]`
                : `[${r.status}]`;

        return {
          inventoryNumber: r.itemInstance?.inventoryNumber || '—',
          name: r.itemInstance?.item?.name || r.itemInstance?.itemName || 'Noma’lum aktiv',
          model: `${r.itemInstance?.item?.model || r.itemInstance?.itemModel || ''} ${tag}`.trim(),
          serialNumber: r.itemInstance?.serialNumber || '—',
          price: Number(r.itemInstance?.purchasePrice || 0),
          quantity: 1,
          unit: 'dona',
        };
      });
    }

    return [
      ...matchedAssets.map((a) => ({
        inventoryNumber: a.inventoryNumber,
        name: a.itemName,
        model: `${a.itemModel || ''} [TOPILDI - MAVJUD]`,
        serialNumber: a.serialNumber || '—',
        price: a.purchasePrice,
        quantity: 1,
        unit: 'dona',
      })),
      ...missingAssets.map((a) => ({
        inventoryNumber: a.inventoryNumber,
        name: a.itemName,
        model: `${a.itemModel || ''} [KAMOMAD / TOPILMADI]`,
        serialNumber: a.serialNumber || '—',
        price: a.purchasePrice,
        quantity: 1,
        unit: 'dona',
      })),
      ...unexpectedAssets.map((a) => ({
        inventoryNumber: a.inventoryNumber,
        name: a.itemName,
        model: `${a.itemModel || ''} [BEGONA XONADAN: ${a.roomName || 'Boshqa joy'}]`,
        serialNumber: a.serialNumber || '—',
        price: a.purchasePrice,
        quantity: 1,
        unit: 'dona',
      })),
    ];
  }, [auditDetail, matchedAssets, missingAssets, unexpectedAssets]);

  // Table items based on tab
  const getTableData = () => {
    if (activeTab === 'MATCHED') return matchedAssets;
    if (activeTab === 'MISSING') return missingAssets;
    if (activeTab === 'UNEXPECTED') return unexpectedAssets;
    return [...expectedAssets, ...unexpectedAssets];
  };

  const totalAuditExpected = expectedAssets.length;

  const renderRecentScansCard = () => (
    <Card
      className="uwms-card"
      style={{ borderRadius: 0, marginTop: 16 }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            <IconCalendarClock style={{ color: '#165DFF' }} />
            <span>Oxirgi 5 ta Skanerlangan Ashyo</span>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Jami o‘qilgan: <b>{scannedCodes.length}</b> ta
          </Text>
        </div>
      }
    >
      {recentScans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-3)' }}>
          <IconScan style={{ fontSize: 24, marginBottom: 6, color: '#86909C' }} />
          <div style={{ fontSize: 13 }}>Hozircha birorta ham ashyo skanerlanmadi</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentScans.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: idx === 0 ? 'var(--color-fill-2)' : 'var(--color-fill-1)',
                borderLeft: idx === 0 ? '4px solid #165DFF' : '4px solid transparent',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>
                  {item.itemName}
                </div>
                <Space size="small" style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                  <span>Inv: <b>{item.inventoryNumber}</b></span>
                  <span>•</span>
                  <span>{item.scannedAt}</span>
                </Space>
              </div>
              <Space size="small">
                {item.roomStatus === 'MATCHED' && (
                  <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>
                    Mavjud
                  </Tag>
                )}
                {item.roomStatus === 'RELOCATED' && (
                  <Tag color="gold" icon={<IconExclamationCircle />} style={{ borderRadius: 0 }}>
                    Begona
                  </Tag>
                )}
                {item.roomStatus === 'UNKNOWN' && (
                  <Tag color="gray" style={{ borderRadius: 0 }}>
                    Noma’lum
                  </Tag>
                )}
                {item.isOffline ? (
                  <Tag color="orange" style={{ borderRadius: 0 }}>Offline Navbat</Tag>
                ) : (
                  <Tag color="arcoblue" style={{ borderRadius: 0 }}>Sinxron</Tag>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Offline Queue Alert */}
      {offlineQueue.length > 0 && (
        <Alert
          type="warning"
          icon={<IconWifi />}
          title={
            <Space>
              <span>Oflayn Navbat: <b>{offlineQueue.length}</b> ta skan saqlangan</span>
              {isOnline ? (
                <Tag color="green" style={{ borderRadius: 0 }}>Tarmoq mavjud (Sinxronlash mumkin)</Tag>
              ) : (
                <Tag color="red" style={{ borderRadius: 0 }}>Tarmoq uzilgan (Oflayn rejim)</Tag>
              )}
            </Space>
          }
          content={
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Internet aloqasi bo‘lmaganda o‘qilgan QR kodlar qurilmada xavfsiz saqlanadi. Tranzaksion sinxronlash orqali barchasi bir vaqtda bazaga yoziladi va kamomad/mavjudlik qayd etiladi.
            </div>
          }
          action={
            <Button
              type="primary"
              status="warning"
              size="small"
              icon={<IconSync spin={isSyncing} />}
              loading={isSyncing}
              onClick={syncOfflineQueue}
              style={{ borderRadius: 0 }}
            >
              Tranzaksion Sinxronlash
            </Button>
          }
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Collision Guard (To'qnashuvdan himoya) Alert */}
      {collisionAlert && (
        <Alert
          type="error"
          icon={<IconExclamationCircle />}
          closable
          onClose={() => setCollisionAlert(null)}
          title="⚠️ Qayta Skanerlash To‘qnashuvi Aniqlangan (Collision Guard)!"
          content={
            <div style={{ fontSize: 13, marginTop: 4 }}>
              <b>{collisionAlert.message}</b>
              <div style={{ color: 'var(--color-text-3)', fontSize: 12, marginTop: 2 }}>
                Agar ushbu jihoz rostdan ham boshqa xonadan olib kelingan bo‘lsa, u nomutanosiblik (RELOCATED) sifatida tizimda rasmiylashtiriladi.
              </div>
            </div>
          }
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Room Selection and Options Header */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Space align="center">
              <Title heading={5} style={{ margin: 0 }}>
                {currentRoom ? `${currentRoom.number}-xona: ${currentRoom.name}` : 'Mobil QR Audit va Inventarizatsiya'}
              </Title>
              {isSocketConnected ? (
                <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0, fontWeight: 600 }}>
                  Real-Time Sync (Faol)
                </Tag>
              ) : (
                <Tag color="gray" style={{ borderRadius: 0 }}>
                  Offline
                </Tag>
              )}
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Moddiy javobgar: <b>{currentRoom?.responsibleUserName || 'Belgilanmagan'}</b> | Bino: {currentRoom?.building || 'Bosh bino'}
              </Text>
            </div>
          </div>

          <Space size="medium" wrap>
            <Button
              size="small"
              type={isMobileView ? 'primary' : 'outline'}
              icon={isMobileView ? <IconDesktop /> : <IconMobile />}
              onClick={() => handleToggleView(!isMobileView)}
              style={{ borderRadius: 0 }}
            >
              {isMobileView ? 'Keng Ko‘rinish (Jadval)' : 'Mobil Rejim'}
            </Button>

            <Space size="small">
              <IconSound style={{ color: soundEnabled ? '#165DFF' : '#86909C' }} />
              <span style={{ fontSize: 13 }}>Ovoz:</span>
              <Switch checked={soundEnabled} onChange={setSoundEnabled} size="small" />
            </Space>

            <span style={{ fontWeight: 600, fontSize: 13 }}>Reja / Kampaniya:</span>
            <Select
              placeholder="Kampaniyasiz (yakka audit)"
              value={selectedCampaignId || undefined}
              onChange={(val) => setSelectedCampaignId(val || '')}
              style={{ width: 200, borderRadius: 0 }}
              allowClear
            >
              {campaigns.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.title} ({c.campaignNumber})
                </Select.Option>
              ))}
            </Select>

            <span style={{ fontWeight: 600, fontSize: 13 }}>Xonani tanlash:</span>
            <Select
              value={selectedRoomId}
              onChange={(val) => {
                setSelectedRoomId(val);
                setScannedCodes([]);
                setRecentScans([]);
              }}
              style={{ width: 220, borderRadius: 0 }}
            >
              {rooms.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.number}-xona: {r.name}
                </Select.Option>
              ))}
            </Select>

            <Popconfirm
              title="Ushbu xona auditini qayta boshlaysizmi?"
              onOk={handleResetAudit}
              okText="Ha"
              cancelText="Yo‘q"
            >
              <Button icon={<IconRefresh />} style={{ borderRadius: 0 }}>
                Qayta Boshlash
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      {/* RENDER VIEW: MOBILE MODE vs DESKTOP MODE */}
      {isMobileView ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mobil Skaner Zonasi */}
          <Card
            className="uwms-card"
            style={{ borderRadius: 0 }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Space>
                  <IconScan style={{ color: '#165DFF' }} />
                  <span>Katta Skanerlash Maydoni</span>
                </Space>
                <Space size="small">
                  {isOnline ? (
                    <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0 }}>Online</Tag>
                  ) : (
                    <Tag color="red" icon={<IconWifi />} style={{ borderRadius: 0 }}>Offline</Tag>
                  )}
                </Space>
              </div>
            }
          >
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div
                style={{
                  width: '100%',
                  minHeight: 260,
                  border: isCameraRunning ? '3px solid #165DFF' : '2px dashed #C9CDD4',
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 12,
                }}
              >
                <div
                  id="audit-qr-reader"
                  style={{
                    width: '100%',
                    minHeight: 260,
                  }}
                />
                {!isCameraRunning && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'var(--color-fill-1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-3)',
                      padding: 16,
                      zIndex: 2,
                    }}
                  >
                    <IconCamera style={{ fontSize: 40, marginBottom: 8, color: '#86909C' }} />
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Kamera hozircha o‘chiq</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Kamerani yoqib QR kodni ekranga tuting yoki qo‘lda kod kiriting
                    </div>
                  </div>
                )}
                {cameraLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      zIndex: 3,
                    }}
                  >
                    <Spin dot />
                    <div style={{ marginTop: 8, fontSize: 12 }}>Kamera ishga tushirilmoqda...</div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                {!isCameraRunning ? (
                  <Button
                    type="primary"
                    size="large"
                    loading={cameraLoading}
                    icon={<IconCamera />}
                    onClick={startCamera}
                    style={{ borderRadius: 0, backgroundColor: '#165DFF', width: '100%', height: 44, fontSize: 15 }}
                  >
                    Kamerani Yoqish
                  </Button>
                ) : (
                  <Button
                    status="danger"
                    size="large"
                    icon={<IconStop />}
                    onClick={stopCamera}
                    style={{ borderRadius: 0, width: '100%', height: 44, fontSize: 15 }}
                  >
                    Kamerani To‘xtatish
                  </Button>
                )}
              </div>

              {availableCameras.length > 1 && (
                <div style={{ marginBottom: 12 }}>
                  <Select
                    size="small"
                    value={selectedCameraId}
                    onChange={(val) => {
                      setSelectedCameraId(val);
                      if (isCameraRunning) {
                        stopCamera().then(() => {
                          setTimeout(() => startCamera(), 300);
                        });
                      }
                    }}
                    style={{ width: '100%' }}
                    prefix="Kamera:"
                  >
                    {availableCameras.map((cam, idx) => (
                      <Select.Option key={cam.id} value={cam.id}>
                        {cam.label || `Kamera ${idx + 1}`}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Barcode scanner gun / manual input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Input
                  size="large"
                  placeholder="QR kod yoki inventar №..."
                  value={manualCode}
                  onChange={setManualCode}
                  onPressEnter={() => handleScan(manualCode)}
                  style={{ borderRadius: 0 }}
                />
                <Button
                  type="primary"
                  size="large"
                  onClick={() => handleScan(manualCode)}
                  style={{ borderRadius: 0, backgroundColor: '#165DFF', minWidth: 90 }}
                >
                  O‘qish
                </Button>
              </div>

              {/* Quick simulation buttons */}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Tezkor test simulyatsiyasi:
                </div>
                <Space wrap size="mini">
                  {expectedAssets.slice(0, 5).map((a) => (
                    <Button
                      key={a.id}
                      size="mini"
                      type={scannedCodes.includes(a.qrCode) ? 'primary' : 'outline'}
                      status={scannedCodes.includes(a.qrCode) ? 'success' : 'default'}
                      onClick={() => handleScan(a.qrCode)}
                      style={{ borderRadius: 0 }}
                    >
                      {a.inventoryNumber}
                    </Button>
                  ))}
                  {assets.find((a) => a.roomId !== selectedRoomId) && (
                    <Button
                      size="mini"
                      status="warning"
                      style={{ borderRadius: 0 }}
                      onClick={() => {
                        const foreign = assets.find((a) => a.roomId !== selectedRoomId);
                        if (foreign) handleScan(foreign.qrCode);
                      }}
                    >
                      Begona (Test)
                    </Button>
                  )}
                </Space>
              </div>
            </div>
          </Card>

          {/* Mobil Progress Ko‘rsatkichi */}
          <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '12px 16px' }}>
            <StockLevelGauge
              percent={completionPercent}
              label={<span>Inventarizatsiya qamrovi:</span>}
              subLabel={
                <b>
                  {matchedAssets.length} / {expectedAssets.length} ta vosita tasdiqlandi ({completionPercent}%)
                </b>
              }
              status={completionPercent === 100 ? 'success' : 'normal'}
              color={completionPercent === 100 ? '#00B42A' : '#165DFF'}
              strokeWidth={8}
              width="100%"
            />
          </Card>

          {/* Oxirgi 5 ta skan ro‘yxati */}
          {renderRecentScansCard()}

          {/* Mobil Harakatlar Tugmalari */}
          <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="medium">
              <Button
                type="primary"
                status="success"
                long
                size="large"
                icon={<IconFile />}
                onClick={() => setIsDocModalVisible(true)}
                disabled={scannedCodes.length === 0}
                style={{ borderRadius: 0, height: 42 }}
              >
                INV-19 Dalolatnomasi
              </Button>

              <Popconfirm
                title="Auditni yakunlash va Kamomadlarni (MISSING) qayd etish"
                content="Haqiqatan ham ushbu xona inventarizatsiyasini yakunlamoqchimisiz? Topilmagan barcha ashyolar bazada kamomad sifatida saqlanadi."
                okText="Ha, yakunlash"
                cancelText="Bekor qilish"
                onOk={handleCompleteAudit}
                disabled={!activeAuditId || isCompleted}
              >
                <Button
                  type="primary"
                  status="warning"
                  long
                  size="large"
                  icon={<IconCheckCircle />}
                  loading={isCompleting}
                  disabled={!activeAuditId || isCompleted}
                  style={{ borderRadius: 0, height: 42 }}
                >
                  {isCompleted ? 'Audit Yakunlangan' : 'Auditni Yakunlash (DB)'}
                </Button>
              </Popconfirm>

              <Button
                type="outline"
                long
                icon={<IconDownload />}
                onClick={handleExportAuditExcel}
                style={{ borderRadius: 0 }}
              >
                Excelga eksport
              </Button>
            </Space>
          </Card>
        </div>
      ) : (
        /* DESKTOP 2-COLUMN VIEW */
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card
              className="uwms-card"
              style={{ borderRadius: 0 }}
              title={
                <Space>
                  <IconScan style={{ color: '#165DFF' }} />
                  <span>QR Skanerlash Moduli</span>
                </Space>
              }
            >
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div
                  style={{
                    width: '100%',
                    minHeight: 240,
                    border: isCameraRunning ? '2px solid #165DFF' : '2px dashed #C9CDD4',
                    borderRadius: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#000',
                    position: 'relative',
                    overflow: 'hidden',
                    marginBottom: 16,
                  }}
                >
                  <div
                    id="audit-qr-reader"
                    style={{
                      width: '100%',
                      minHeight: 240,
                    }}
                  />
                  {!isCameraRunning && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'var(--color-fill-1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-3)',
                        padding: 16,
                        zIndex: 2,
                      }}
                    >
                      <IconCamera style={{ fontSize: 36, marginBottom: 8, color: '#86909C' }} />
                      <div style={{ fontSize: 13 }}>Kamera hozirda o‘chiq</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Jonli skanerlash uchun kamerani yoqing yoki qo‘lda kod kiriting
                      </div>
                    </div>
                  )}
                  {cameraLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        zIndex: 3,
                      }}
                    >
                      <Spin dot />
                      <div style={{ marginTop: 8, fontSize: 12 }}>Kamera ishga tushirilmoqda...</div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  {!isCameraRunning ? (
                    <Button
                      type="primary"
                      loading={cameraLoading}
                      icon={<IconCamera />}
                      onClick={startCamera}
                      style={{ borderRadius: 0, backgroundColor: '#165DFF', width: '100%' }}
                    >
                      Kamerani Yoqish
                    </Button>
                  ) : (
                    <Button
                      status="danger"
                      icon={<IconStop />}
                      onClick={stopCamera}
                      style={{ borderRadius: 0, width: '100%' }}
                    >
                      Kamerani To‘xtatish
                    </Button>
                  )}
                </div>

                {availableCameras.length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <Select
                      size="small"
                      value={selectedCameraId}
                      onChange={(val) => {
                        setSelectedCameraId(val);
                        if (isCameraRunning) {
                          stopCamera().then(() => {
                            setTimeout(() => startCamera(), 300);
                          });
                        }
                      }}
                      style={{ width: '100%' }}
                      prefix="Kamera:"
                    >
                      {availableCameras.map((cam, idx) => (
                        <Select.Option key={cam.id} value={cam.id}>
                          {cam.label || `Kamera ${idx + 1}`}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* Input for manual scanner / barcode guns */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Shtrix-kod skaneri (Laser gun) / Qo‘lda kiritish:</Text>
                  <Tag color="arcoblue" size="small" style={{ borderRadius: 0 }}>USB Skaner Faol</Tag>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <Input
                    placeholder="QR kod yoki inventar № (Enter bosing)..."
                    value={manualCode}
                    onChange={setManualCode}
                    onPressEnter={() => handleScan(manualCode)}
                    style={{ borderRadius: 0 }}
                  />
                  <Button
                    type="primary"
                    onClick={() => handleScan(manualCode)}
                    style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                  >
                    O‘qish
                  </Button>
                </div>

                {/* Quick simulation chips */}
                <div style={{ textAlign: 'left', marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>
                    Tezkor test simulyatsiyasi:
                  </div>
                  <Space wrap size="mini">
                    {expectedAssets.map((a) => (
                      <Button
                        key={a.id}
                        size="mini"
                        type={scannedCodes.includes(a.qrCode) ? 'primary' : 'outline'}
                        status={scannedCodes.includes(a.qrCode) ? 'success' : 'default'}
                        onClick={() => handleScan(a.qrCode)}
                        style={{ borderRadius: 0 }}
                      >
                        {a.inventoryNumber}
                      </Button>
                    ))}
                    {assets.find((a) => a.roomId !== selectedRoomId) && (
                      <Button
                        size="mini"
                        status="warning"
                        style={{ borderRadius: 0 }}
                        onClick={() => {
                          const foreign = assets.find((a) => a.roomId !== selectedRoomId);
                          if (foreign) handleScan(foreign.qrCode);
                        }}
                      >
                        Begona Uskuna (Test)
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            </Card>

            {/* Oxirgi 5 ta skan (Recent 5 Scans) */}
            {renderRecentScansCard()}
          </Col>

          {/* Audit Results & Discrepancy Table */}
          <Col xs={24} md={16}>
            <Card
              className="uwms-card"
              style={{ borderRadius: 0 }}
              title={
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <span>
                    Audit Jarayoni (Mas’ul: <b>{currentRoom?.responsibleUserName || 'MOL'}</b>)
                  </span>
                  <Space size="small">
                    <Button
                      type="outline"
                      size="small"
                      icon={<IconDownload />}
                      onClick={handleExportAuditExcel}
                      style={{ borderRadius: 0 }}
                    >
                      Excelga
                    </Button>
                    <Popconfirm
                      title="Auditni yakunlash va Kamomadlarni (MISSING) qayd etish"
                      content="Haqiqatan ham ushbu xona inventarizatsiyasini yakunlamoqchimisiz? Topilmagan barcha ashyolar bazada kamomad sifatida saqlanadi."
                      okText="Ha, yakunlash"
                      cancelText="Bekor qilish"
                      onOk={handleCompleteAudit}
                      disabled={!activeAuditId || isCompleted}
                    >
                      <Button
                        type="primary"
                        status="warning"
                        size="small"
                        icon={<IconCheckCircle />}
                        loading={isCompleting}
                        disabled={!activeAuditId || isCompleted}
                        style={{ borderRadius: 0 }}
                      >
                        {isCompleted ? 'Audit Yakunlangan' : 'Auditni Yakunlash (DB)'}
                      </Button>
                    </Popconfirm>
                    <Button
                      type="primary"
                      status="success"
                      size="small"
                      icon={<IconFile />}
                      onClick={() => setIsDocModalVisible(true)}
                      disabled={scannedCodes.length === 0}
                      style={{ borderRadius: 0 }}
                    >
                      INV-19 Dalolatnomasi
                    </Button>
                  </Space>
                </div>
              }
            >
              <div style={{ marginBottom: 16 }}>
                <StockLevelGauge
                  percent={completionPercent}
                  label={<span>Inventarizatsiya mosligi:</span>}
                  subLabel={
                    <b>
                      {matchedAssets.length} / {expectedAssets.length} ta vosita tasdiqlandi ({completionPercent}%)
                    </b>
                  }
                  status={completionPercent === 100 ? 'success' : 'normal'}
                  color={completionPercent === 100 ? '#00B42A' : '#165DFF'}
                  strokeWidth={8}
                  width="100%"
                />
              </div>

              {/* Foreign assets alert */}
              {unexpectedAssets.length > 0 && (
                <Alert
                  type="warning"
                  icon={<IconExclamationCircle />}
                  title="Boshqa xonaga tegishli uskunalar aniqlandi!"
                  content={
                    <div>
                      Quyidagi vositalar bu xonaga biriktirilmagan bo‘lsa-da, shu xonadan topildi:{' '}
                      <b>
                        {unexpectedAssets.map((a) => `${a.itemName} (${a.inventoryNumber})`).join(', ')}
                      </b>
                    </div>
                  }
                  style={{ marginBottom: 16, borderRadius: 0 }}
                />
              )}

              {/* Reusable PageTabs Filter */}
              <PageTabs
                activeTab={activeTab}
                onChange={setActiveTab}
                tabs={[
                  {
                    key: 'ALL',
                    title: 'Barcha Uskunalar',
                    count: expectedAssets.length + unexpectedAssets.length,
                  },
                  {
                    key: 'MATCHED',
                    title: 'Topildi (Mavjud)',
                    count: matchedAssets.length,
                  },
                  {
                    key: 'MISSING',
                    title: 'Kamomad / Topilmadi',
                    count: missingAssets.length,
                  },
                  ...(unexpectedAssets.length > 0
                    ? [
                      {
                        key: 'UNEXPECTED',
                        title: 'Begona Xonadan',
                        count: unexpectedAssets.length,
                      },
                    ]
                    : []),
                ]}
              />

              <Table
                rowKey="id"
                scroll={{ x: 750 }}
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
                size="small"
                data={getTableData()}
                style={{ borderRadius: 0, marginTop: 12 }}
                noDataElement={
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <Empty description="Ushbu toifadagi uskunalar mavjud emas" />
                  </div>
                }
                columns={[
                  {
                    title: 'Audit Natijasi',
                    width: 170,
                    render: (_, record: ItemInstance) => {
                      const isForeign = record.roomId !== activeRoom;
                      const isScanned = scannedCodes.includes(record.qrCode);

                      if (isForeign && isScanned) {
                        return (
                          <Tag
                            color="gold"
                            icon={<IconExclamationCircle />}
                            style={{ borderRadius: 0, fontWeight: 500 }}
                          >
                            Begona Xonadan
                          </Tag>
                        );
                      }
                      if (isScanned) {
                        return (
                          <Tag
                            color="green"
                            icon={<IconCheckCircle />}
                            style={{ borderRadius: 0, fontWeight: 500 }}
                          >
                            Mavjud (Topildi)
                          </Tag>
                        );
                      }
                      return (
                        <Tag
                          color="red"
                          icon={<IconCloseCircle />}
                          style={{ borderRadius: 0, fontWeight: 500 }}
                        >
                          Kutilmoqda (Kamomad)
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Asosiy Vosita',
                    render: (_, record: ItemInstance) => (
                      <CategoryThumbnail
                        icon={<IconScan />}
                        name={record.itemName}
                        subtitle={`Inv: ${record.inventoryNumber}${record.itemModel ? ` | ${record.itemModel}` : ''}`}
                        tag={record.serialNumber ? `SN: ${record.serialNumber}` : undefined}
                        color="#165DFF"
                        bg="#E8F3FF"
                      />
                    ),
                  },
                  {
                    title: 'Kutilgan Xona',
                    dataIndex: 'roomName',
                    width: 140,
                    render: (val: string) => val || currentRoom?.name || '—',
                  },
                  {
                    title: 'Mas’ul Shaxs',
                    dataIndex: 'responsibleUserName',
                    width: 160,
                    render: (val: string) => val || '—',
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Official State Standard INV-19 Document Modal */}
      <OfficialDocModal
        visible={isDocModalVisible}
        onClose={() => setIsDocModalVisible(false)}
        docType="AUDIT"
        entityId={auditDetail?.id || currentRoom?.id}
        docNumber={auditDetail?.auditNumber || `INV-19-${currentRoom?.number || '01'}`}
        date={
          auditDetail?.completedAt
            ? new Date(auditDetail.completedAt).toLocaleDateString('uz-UZ')
            : new Date().toLocaleDateString('uz-UZ')
        }
        sourceLocation={currentRoom ? `${currentRoom.number}-xona: ${currentRoom.name}` : ''}
        senderName={auditDetail?.room?.responsibleUser?.fullName || currentRoom?.responsibleUserName || ''}
        receiverName={auditDetail?.createdBy?.fullName || user?.fullName || ''}
        signatures={
          auditDetail?.completedAt
            ? [
                {
                  role: 'Moddiy Javobgar Shaxs',
                  name: auditDetail.room?.responsibleUser?.fullName || currentRoom?.responsibleUserName || '',
                  isSigned: true,
                  signedAt: new Date(auditDetail.completedAt).toLocaleString('uz-UZ'),
                  biometricType: 'FaceID (QR-Pairing)',
                },
                {
                  role: 'Bosh Auditor',
                  name: auditDetail.createdBy?.fullName || user?.fullName || '',
                  isSigned: true,
                  signedAt: new Date(auditDetail.completedAt).toLocaleString('uz-UZ'),
                  biometricType: 'FaceID (QR-Pairing)',
                },
              ].filter((s) => s.name)
            : undefined
        }
        reason={
          auditDetail
            ? `Davriy auditorlik tekshiruvi va solishtirma qaydnomasi (${auditDetail.auditNumber}). Jami ${auditDetail.records?.length || 0} ta tekshirilgan ashyodan ${auditDetail.records?.filter((r: any) => r.status === 'MATCHED').length || 0} tasi mavjud, ${auditDetail.records?.filter((r: any) => r.status === 'MISSING').length || 0} tasi kamomad (topilmadi), ${auditDetail.records?.filter((r: any) => r.status === 'RELOCATED').length || 0} tasi begona joydan topilgan uskunalar deb qayd etildi.`
            : `Davriy auditorlik tekshiruvi va solishtirma dalolatnomasi. Jami ${expectedAssets.length} ta kutilgan vositadan ${matchedAssets.length} tasi mavjud, ${missingAssets.length} tasi kamomad.`
        }
        items={auditDocItems}
      />
    </div>
  );
};
