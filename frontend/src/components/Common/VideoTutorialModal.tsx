import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Space,
  Tag,
  Typography,
  Grid,
  Radio,
} from '@arco-design/web-react';
import {
  IconPlayCircle,
  IconPause,
  IconDownload,
  IconArchive,
  IconUser,
  IconBook,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import { formatRoleName } from '../../constants/roles.constants';

const { Text } = Typography;
const { Row, Col } = Grid;

export interface TutorialChapter {
  id: number;
  timeSeconds: number;
  timestamp: string;
  stepCode: string;
  title: string;
  description: string;
}

// 1. MAS'UL XODIMLAR (MOL) UCHUN 23 TA BOSQICH (03:24)
export const TUTORIAL_MOL_CHAPTERS: TutorialChapter[] = [
  {
    id: 1,
    timeSeconds: 1,
    timestamp: '00:01',
    stepCode: 'KIRISH',
    title: 'UWMS — Mas’ul Xodimlar Qo‘llanmasi',
    description: 'Tizimning asosiy imkoniyatlari va qamrovi bilan tanishuv',
  },
  {
    id: 2,
    timeSeconds: 7,
    timestamp: '00:07',
    stepCode: '1-BOSQICH',
    title: 'Tizimga kirish va avtorizatsiya',
    description: 'Mas’ul xodim logini va paroli orqali xavfsiz kirish',
  },
  {
    id: 3,
    timeSeconds: 16,
    timestamp: '00:16',
    stepCode: '2.1-BOSQICH',
    title: 'Yon panelni boshqarish (Sidebar)',
    description: 'Yon menyuni yig‘ish va katta jadvallar uchun kengaytirish',
  },
  {
    id: 4,
    timeSeconds: 25,
    timestamp: '00:25',
    stepCode: '2.2-BOSQICH',
    title: 'Universal tezkor qidiruv (Ctrl + K)',
    description: 'Aktiv, xona yoki xodimni butun universitet bo‘yicha topish',
  },
  {
    id: 5,
    timeSeconds: 35,
    timestamp: '00:35',
    stepCode: '2.3-BOSQICH',
    title: 'Tezkor yaratish menyusi (+ Yangi)',
    description: 'Istalgan sahifada bir bosishda yangi talabnoma ochish',
  },
  {
    id: 6,
    timeSeconds: 42,
    timestamp: '00:42',
    stepCode: '2.4-BOSQICH',
    title: 'Tizim tilini tanlash',
    description: 'O‘zbekcha, Ruscha va Inglizcha interfeysni almashtirish',
  },
  {
    id: 7,
    timeSeconds: 50,
    timestamp: '00:50',
    stepCode: '2.5-BOSQICH',
    title: 'Tungi (Dark) va Kunduzgi mavzu',
    description: 'Ko‘z toliqishining oldini oluvchi kontrast mavzular',
  },
  {
    id: 8,
    timeSeconds: 58,
    timestamp: '00:58',
    stepCode: '2.6-BOSQICH',
    title: 'Jonli bildirishnomalar markazi',
    description: 'Hujjatlar va tasdiqlash xabarlarini real vaqtda kuzatish',
  },
  {
    id: 9,
    timeSeconds: 66,
    timestamp: '01:06',
    stepCode: '2.7-BOSQICH',
    title: 'Mas’ul xodim profili va xavfsiz chiqish',
    description: 'Foydalanuvchi ma’lumotlari va sessiyani to‘g‘ri yakunlash',
  },
  {
    id: 10,
    timeSeconds: 72,
    timestamp: '01:12',
    stepCode: '3-BOSQICH',
    title: 'Asosiy Boshqaruv Paneli (Dashboard)',
    description: 'Kafedra aktivlari, xonalar soni va tezkor statistik ko‘rsatkichlar',
  },
  {
    id: 11,
    timeSeconds: 81,
    timestamp: '01:21',
    stepCode: '4-BOSQICH',
    title: 'Vazifalarim (Inbox) — Mas’ul topshiriqlari',
    description: 'Tasdiqlash va imzolash uchun kelgan arizalar ro‘yxati',
  },
  {
    id: 12,
    timeSeconds: 87,
    timestamp: '01:27',
    stepCode: '4.1-BOSQICH',
    title: 'Vositalarni tekshirish va Qabul qilish',
    description: 'Ashyolarni solishtirish va OS-1 qabul qilish dalolatnomasini imzolash',
  },
  {
    id: 13,
    timeSeconds: 100,
    timestamp: '01:40',
    stepCode: '5-BOSQICH',
    title: 'Asosiy vositalar reestri & QR pasport',
    description: 'Kafedraning kompyuter va texnikalari, QR stikerlar',
  },
  {
    id: 14,
    timeSeconds: 106,
    timestamp: '01:46',
    stepCode: '5.1-BOSQICH',
    title: 'Aktivlarni topshirish (MOL Vizardi)',
    description: 'Mas’uliyatni yangi xodimga topshirish bo‘yicha 2 bosqichli vizard',
  },
  {
    id: 15,
    timeSeconds: 119,
    timestamp: '01:59',
    stepCode: '6-BOSQICH',
    title: 'Yangi talabnoma (Zayavka) yaratish',
    description: 'Kafedra sarf materiallari ehtiyojini kiritishni boshlash',
  },
  {
    id: 16,
    timeSeconds: 135,
    timestamp: '02:15',
    stepCode: '6.1-BOSQICH',
    title: 'Mahsulot kiritish va savatchaga qo‘shish',
    description: 'SvetoCopy A4 qog‘ozini kiritish va ro‘yxatga qo‘shish',
  },
  {
    id: 17,
    timeSeconds: 140,
    timestamp: '02:20',
    stepCode: '6.2-BOSQICH',
    title: 'Talabnomani omborga rasman yuborish',
    description: 'Bir bosish orqali arizani omborga rasmiy ijroga jo‘natish',
  },
  {
    id: 18,
    timeSeconds: 150,
    timestamp: '02:30',
    stepCode: '6.3-BOSQICH',
    title: '"Batafsil" — 7-Bosqichli Jonli Xarid Zanjiri',
    description: 'Arizaning moliya, xarid, ombor va tarqatish bosqichlari monitoringi',
  },
  {
    id: 19,
    timeSeconds: 164,
    timestamp: '02:44',
    stepCode: '7-BOSQICH',
    title: 'Ta’mirlash & Servis jurnali',
    description: 'Nosoz kompyuter va printerlarni servisga topshirish',
  },
  {
    id: 20,
    timeSeconds: 172,
    timestamp: '02:52',
    stepCode: '8-BOSQICH',
    title: 'Spisanie (OS-4) — Hisobdan chiqarish',
    description: 'Yaroqsiz mulklarni komissiya akti bilan balansdan chiqarish',
  },
  {
    id: 21,
    timeSeconds: 178,
    timestamp: '02:58',
    stepCode: '9-BOSQICH',
    title: 'Tuzilma & Xonalar sahifasi',
    description: 'Bino, kafedra va xonalarning umumiy topografik xaritasi',
  },
  {
    id: 22,
    timeSeconds: 183,
    timestamp: '03:03',
    stepCode: '9.1-BOSQICH',
    title: 'Daraxtsimon menyu (Tree Navigation)',
    description: 'Bino va kafedra bo‘yicha iyerarxik daraxtni boshqarish',
  },
  {
    id: 23,
    timeSeconds: 193,
    timestamp: '03:13',
    stepCode: 'YAKUN',
    title: 'Xulosa va tavsiyalar',
    description: 'Mas’ul xodimlar (MOL) uchun yakuniy qoidalar',
  },
];

// 2. BOSH OMBOR MUDIRI (OMBORCHI) UCHUN 14 TA BOSQICH (02:27)
export const TUTORIAL_OMBORCHI_CHAPTERS: TutorialChapter[] = [
  {
    id: 1,
    timeSeconds: 1,
    timestamp: '00:01',
    stepCode: 'KIRISH',
    title: 'Bosh Ombor Mudiri (Omborchi) Qo‘llanmasi',
    description: 'Ombor zaxiralarini boshqarish, kirim-chiqim va audit jarayonlari',
  },
  {
    id: 2,
    timeSeconds: 7,
    timestamp: '00:07',
    stepCode: '1-BOSQICH',
    title: 'Tizimga kirish va avtorizatsiya',
    description: 'Bosh ombor mudiri logini va paroli orqali tizimga kirish',
  },
  {
    id: 3,
    timeSeconds: 18,
    timestamp: '00:18',
    stepCode: '2-BOSQICH',
    title: 'Boshqaruv Paneli — Ombor operativ tahlili',
    description: 'Jami sarf zaxirasi, kam qolgan tovarlar (Low Stock) va ijrodagi talabnomalar',
  },
  {
    id: 4,
    timeSeconds: 28,
    timestamp: '00:28',
    stepCode: '3-BOSQICH',
    title: 'Sarf Tovarlari & Qoldiq — Ombor reestri',
    description: 'Materiallar qoldig‘i, minimal chegara va qoldiq monitoringi',
  },
  {
    id: 5,
    timeSeconds: 41,
    timestamp: '00:41',
    stepCode: '3.1-BOSQICH',
    title: 'Ta’minotchidan Yangi Kirim (OS-1)',
    description: 'Omborga yangi tovarlarni qabul qilish va qoldiqni oshirish',
  },
  {
    id: 6,
    timeSeconds: 53,
    timestamp: '00:53',
    stepCode: '3.2-BOSQICH',
    title: 'Omborlararo Ko‘chirish (Inter-Warehouse)',
    description: 'Markaziy ombor va filiallar o‘rtasida mahsulotlarni taqsimlash',
  },
  {
    id: 7,
    timeSeconds: 65,
    timestamp: '01:05',
    stepCode: '4-BOSQICH',
    title: 'Kafedralar Talabnomalari (Zayavkalar)',
    description: 'Kafedralardan sarf materiallari olish uchun kelgan rasmiy arizalar',
  },
  {
    id: 8,
    timeSeconds: 73,
    timestamp: '01:13',
    stepCode: '4.1-BOSQICH',
    title: 'Talabnomani Ijro Etish (FULFILL)',
    description: 'Ombordan tovar ajratish, avtomatik kamaytirish va 7-bosqichli zanjir',
  },
  {
    id: 9,
    timeSeconds: 85,
    timestamp: '01:25',
    stepCode: '5-BOSQICH',
    title: 'Kirim / Siljish Tarixi (Audit Log)',
    description: 'Barcha kirim, chiqim va ko‘chirish operatsiyalarining rasmiy orderlari',
  },
  {
    id: 10,
    timeSeconds: 96,
    timestamp: '01:36',
    stepCode: '6-BOSQICH',
    title: 'Ta’minot & Shartnomalar (Kontragentlar)',
    description: 'Mahsulot yetkazib beruvchi korxonalar reestri va hisob-kitoblar',
  },
  {
    id: 11,
    timeSeconds: 103,
    timestamp: '01:43',
    stepCode: '7-BOSQICH',
    title: 'Asosiy Vositalar Reestri va QR-Stikerlar',
    description: 'Yangi uskunalarga inventar raqam biriktirish va QR yorliq chop etish',
  },
  {
    id: 12,
    timeSeconds: 118,
    timestamp: '01:58',
    stepCode: '8-BOSQICH',
    title: 'QR Inventarizatsiya — Tezkor Sanash',
    description: 'Skaner yordamida ombordagi mahsulotlarni bir soniyada solishtirish',
  },
  {
    id: 13,
    timeSeconds: 126,
    timestamp: '02:06',
    stepCode: '9-BOSQICH',
    title: 'Tezkor Boshqaruv va «Video Qo‘llanma»',
    description: 'Dashboardda video qo‘llanmani ochish va boshqaruv asboblari',
  },
  {
    id: 14,
    timeSeconds: 141,
    timestamp: '02:21',
    stepCode: 'YAKUN',
    title: 'Omborchi Uchun Yakuniy Qoidalar',
    description: 'Faqat tasdiqlangan talabnoma bilan tarqatish va audit butunligi',
  },
];

// 3. BOSH HISOBCHI (MODDIY BUXGALTER) UCHUN 19 TA BOSQICH (03:36)
export const TUTORIAL_BUHGALTER_CHAPTERS: TutorialChapter[] = [
  {
    id: 1,
    timeSeconds: 3,
    timestamp: '00:03',
    stepCode: 'KIRISH',
    title: 'Bosh Hisobchi Qo‘llanmasi (Barcha Sahifalar)',
    description: 'Barcha sahifalar, rangli tugmalar, moliya vizalari, OS-1, OS-2 va UzASBO davlat integratsiyasi',
  },
  {
    id: 2,
    timeSeconds: 8,
    timestamp: '00:08',
    stepCode: '1-BOSQICH',
    title: 'Tizimga kirish va avtorizatsiya',
    description: 'Bosh hisobchi logini (bosh_hisobchi) va maxfiy paroli orqali tizimga kirish',
  },
  {
    id: 3,
    timeSeconds: 19,
    timestamp: '00:19',
    stepCode: '2-BOSQICH',
    title: 'Boshqaruv Paneli va Yuqori Rangli Asboblar',
    description: 'Tezkor qidiruv (Ctrl+K), til tanlash, tungi rejim, + Yangi Zayavka va Video Qo‘llanma tugmalari',
  },
  {
    id: 4,
    timeSeconds: 35,
    timestamp: '00:35',
    stepCode: '3-BOSQICH',
    title: 'Vazifalarim — Moliya Vizasi va Yangi Kirim Tasdig‘i',
    description: 'Sidebar orqali o‘tish va arizalarni tekshirish uchun ko‘k "Ko‘rib chiqish" tugmasi',
  },
  {
    id: 5,
    timeSeconds: 50,
    timestamp: '00:50',
    stepCode: '4-BOSQICH',
    title: 'Asosiy Vositalar Reestri va Davlat Hisobi',
    description: 'Ko‘k "Aktivlarni Topshirish (OS-1)" vizardi, manba filtri va har bir ashyoning "QR Pasport" tugmasi',
  },
  {
    id: 6,
    timeSeconds: 61,
    timestamp: '01:01',
    stepCode: '5-BOSQICH',
    title: 'Ta’minot & Shartnomalar — Kontragentlar Reestri',
    description: 'G‘aznachilik shartnomalari va ko‘k "+ Yangi Ta’minotchi" kontragent qo‘shish oynasi',
  },
  {
    id: 7,
    timeSeconds: 69,
    timestamp: '01:09',
    stepCode: '6-BOSQICH',
    title: 'Talabnomalar — Xarid Zanjiri va Moliya Bosqichlari',
    description: 'Ko‘k "+ Yangi Talabnoma" va har bir arizaning 7 bosqichli "Batafsil" xarid monitoringi tugmasi',
  },
  {
    id: 8,
    timeSeconds: 83,
    timestamp: '01:23',
    stepCode: '7-BOSQICH',
    title: 'Spisanie (OS-4) — Hisobdan Chiqarish Komissiyasi',
    description: 'Yaroqsiz mulklar qoldiq qiymatini tekshirish va ko‘k "Batafsil & Ovoz berish" tugmasi',
  },
  {
    id: 9,
    timeSeconds: 96,
    timestamp: '01:36',
    stepCode: '8-BOSQICH',
    title: 'Amortizatsiya & Qoldiq Qiymat Dvigateli',
    description: '"Davriy Eskirishni Hisoblash" ko‘k kartasi va sub-hisoblar normasi jurnali (013 — 15%, 01 — 10%)',
  },
  {
    id: 10,
    timeSeconds: 105,
    timestamp: '01:45',
    stepCode: '9-BOSQICH',
    title: 'Bosh Hisobchi Daftari — Kirim Reestri (OS-1)',
    description: 'Sub-hisoblar selektori va ko‘k rangli "OS-1 Hujjatini Ko‘rish" rasmiy dalolatnoma tugmasi',
  },
  {
    id: 11,
    timeSeconds: 121,
    timestamp: '02:01',
    stepCode: '10-BOSQICH',
    title: 'Manbalar Hisoboti — Byudjet, Kontrakt va Grant',
    description: 'Byudjet, To‘lov-Kontrakt va Rivojlantirish jamg‘armasi xarajatlari hamda Excel eksporti',
  },
  {
    id: 12,
    timeSeconds: 130,
    timestamp: '02:10',
    stepCode: '11-BOSQICH',
    title: 'Tuzilma & Xonalar — Daraxtsimon Menyu (Tree)',
    description: 'Bino, fakultet va kafedralar iyerarxik daraxti hamda xonalarning moddiy mas’ullari',
  },
  {
    id: 13,
    timeSeconds: 141,
    timestamp: '02:21',
    stepCode: '12-BOSQICH',
    title: 'Kafedralar Kvotasi — Oylik Sarf Limitlari',
    description: 'Kafedralar oylik sarf-xarajat limitlari, qoldiq va smeta nazorati progress barlari',
  },
  {
    id: 14,
    timeSeconds: 149,
    timestamp: '02:29',
    stepCode: '13-BOSQICH',
    title: 'Integratsiyalar — HEMIS va UzASBO / 1C Shlyuzi',
    description: 'HEMIS axborot tizimi holati va 1C / UzASBO buxgalteriya eksporti markazi',
  },
  {
    id: 15,
    timeSeconds: 162,
    timestamp: '02:42',
    stepCode: '13.1-BOSQICH',
    title: 'UzASBO XML va Excel Hisobotini Shakllantirish',
    description: 'Davr (2026-10), Asosiy vositalar (010/013) va ko‘k "Hisobotni Shakllantirish" tugmasini bosish',
  },
  {
    id: 16,
    timeSeconds: 171,
    timestamp: '02:51',
    stepCode: '13.2-BOSQICH',
    title: 'Davlat UzASBO XML Natijasi va Yuklab Olish',
    description: 'DMBAT UzASBO dasturi uchun shakllangan XML kodi, ko‘k "Faylni Yuklab Olish (.xml)" tugmasi',
  },
  {
    id: 17,
    timeSeconds: 182,
    timestamp: '03:02',
    stepCode: '14-BOSQICH',
    title: 'Audit Rejalari — INV-19 Solishtirma Qaydnoma',
    description: 'Yillik inventarizatsiya rejalari, komissiya a’zolari va INV-19 solishtirma dalolatnomalari',
  },
  {
    id: 18,
    timeSeconds: 193,
    timestamp: '03:13',
    stepCode: '15-BOSQICH',
    title: 'Boshqaruv Panelida "Video Qo‘llanma" Markazi',
    description: 'Dashboarddagi ko‘k [▶ Video Qo‘llanma] tugmasi, boblar bo‘yicha sakrash va darsliklar',
  },
  {
    id: 19,
    timeSeconds: 210,
    timestamp: '03:30',
    stepCode: 'YAKUN',
    title: 'Bosh Hisobchi Uchun Yakuniy Qoidalar',
    description: 'Qonuniy faktura intizomi, oylik amortizatsiya uzluksizligi va UzASBO eksporti',
  },
];

export type TutorialRole = 'OMBORCHI' | 'MOL' | 'BUHGALTER';

export const resolveTutorialRole = (userRole?: string, defaultRole?: TutorialRole): TutorialRole => {
  if (defaultRole) return defaultRole;
  const r = (userRole || '').toUpperCase().trim();

  // 1. Warehouse roles
  if (['HEAD_WAREHOUSE', 'WAREHOUSE', 'WAREHOUSEMAN'].includes(r)) {
    return 'OMBORCHI';
  }

  // 2. Accounting & Finance roles
  if (['CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'VICE_RECTOR_FINANCE', 'MODDIY_BUXGALTER'].includes(r)) {
    return 'BUHGALTER';
  }

  // 3. Departments, Sections, and Material Responsible Persons (MOL, COMMENDANT, ENGINEER, EMPLOYEE, TEACHER, etc.):
  return 'MOL';
};

interface VideoTutorialModalProps {
  visible: boolean;
  onClose: () => void;
  defaultRole?: TutorialRole;
}

export const VideoTutorialModal: React.FC<VideoTutorialModalProps> = ({
  visible,
  onClose,
  defaultRole,
}) => {
  const { user } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [activeRole, setActiveRole] = useState<TutorialRole>(() =>
    resolveTutorialRole(user?.role, defaultRole)
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(false);

  // When defaultRole, user role or modal visibility changes, sync activeRole
  useEffect(() => {
    setActiveRole(resolveTutorialRole(user?.role, defaultRole));
  }, [defaultRole, user?.role, visible]);

  const isOmborchi = activeRole === 'OMBORCHI';
  const isBuhgalter = activeRole === 'BUHGALTER';
  const chapters = isOmborchi
    ? TUTORIAL_OMBORCHI_CHAPTERS
    : isBuhgalter
    ? TUTORIAL_BUHGALTER_CHAPTERS
    : TUTORIAL_MOL_CHAPTERS;

  const videoSrc = isOmborchi
    ? '/videos/video_qullanma_omborchi.webm'
    : isBuhgalter
    ? '/videos/video_qullanma_buhgalter.webm'
    : '/videos/video_qullanma_mol.webm';

  const subtitleSrc = isOmborchi
    ? '/videos/video_qullanma_omborchi.vtt'
    : isBuhgalter
    ? '/videos/video_qullanma_buhgalter.vtt'
    : '/videos/video_qullanma_mol.vtt';

  const totalDurationStr = isOmborchi ? '02:27' : isBuhgalter ? '03:36' : '03:24';
  const downloadFileName = isOmborchi
    ? 'UWMS_Omborchi_Qullanma.webm'
    : isBuhgalter
    ? 'UWMS_Bosh_Hisobchi_Qullanma.webm'
    : 'UWMS_Masul_Xodimlar_Qullanma.webm';

  // Handle switching between role tutorials
  const handleRoleChange = (role: TutorialRole) => {
    setActiveRole(role);
    setCurrentTime(0);
    setActiveChapterIndex(0);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
  };

  // Sync active chapter on timeupdate
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    for (let i = chapters.length - 1; i >= 0; i--) {
      if (t >= chapters[i].timeSeconds) {
        setActiveChapterIndex(i);
        break;
      }
    }
  };

  const handleSeekChapter = (chapter: TutorialChapter) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = chapter.timeSeconds;
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Pause video when modal is closed
  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [visible]);

  // Ensure captions / textTracks are strictly OFF by default
  useEffect(() => {
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = showSubtitles ? 'showing' : 'disabled';
      }
    }
  }, [showSubtitles, visible, activeRole]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const modalRoleTitle = isBuhgalter
    ? 'Bosh Hisobchi Video Qo‘llanmasi'
    : isOmborchi
    ? 'Bosh Ombor Mudiri Video Qo‘llanmasi'
    : 'Kafedra va Mas’ul Xodimlar Video Qo‘llanmasi';

  const modalRoleSubtitle = isBuhgalter
    ? 'Bosh hisobchi va moddiy buxgalterlar uchun • 19 ta asosiy bosqich (UzASBO/1C gacha)'
    : isOmborchi
    ? 'Bosh ombor mudirlari va ombor xodimlari uchun • 14 ta asosiy bosqich'
    : 'Kafedra mudirlari, komendantlar, o‘qituvchilar, injenerlar va mas’ul xodimlar (MOL) uchun • 23 ta bosqich';

  return (
    <Modal
      title={
        <Space>
          <IconPlayCircle style={{ color: '#165DFF', fontSize: 24 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              UWMS — {modalRoleTitle} (Full HD 1080p)
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 400 }}>
              {modalRoleSubtitle}
            </div>
          </div>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 1120, maxWidth: '96vw', top: 20, borderRadius: 0 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Space>
            <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 600 }}>
              Davomiyligi: {totalDurationStr} ({chapters.length} ta bosqich)
            </Tag>
            <Tag color="green" style={{ borderRadius: 0, fontWeight: 600 }}>
              Format: Full HD 1080p
            </Tag>
          </Space>
          <Space>
            <Button
              icon={<IconDownload />}
              href={videoSrc}
              download={downloadFileName}
              style={{ borderRadius: 0 }}
            >
              Yuklab olish (Offline)
            </Button>
            <Button type="primary" onClick={onClose} style={{ borderRadius: 0 }}>
              Yopish
            </Button>
          </Space>
        </div>
      }
    >
      {/* Role tutorial switcher bar: strictly only visible for ADMIN / SUPER_ADMIN */}
      {isAdmin ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
            borderBottom: '1px solid var(--color-border-2)',
            paddingBottom: 10,
          }}
        >
          <Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Admin ko‘rinishi (Barcha rollar):
            </Typography.Text>
            <Radio.Group
              type="button"
              value={activeRole}
              onChange={(val) => handleRoleChange(val as TutorialRole)}
              style={{ borderRadius: 0 }}
            >
              <Radio value="BUHGALTER">
                <Space size={4}>
                  <IconBook />
                  <span>Bosh Hisobchi (03:36)</span>
                </Space>
              </Radio>
              <Radio value="OMBORCHI">
                <Space size={4}>
                  <IconArchive />
                  <span>Bosh Ombor Mudiri (02:27)</span>
                </Space>
              </Radio>
              <Radio value="MOL">
                <Space size={4}>
                  <IconUser />
                  <span>Mas’ul Xodimlar / MOL (03:24)</span>
                </Space>
              </Radio>
            </Radio.Group>
          </Space>

          <Tag
            color={isBuhgalter ? 'magenta' : isOmborchi ? 'arcoblue' : 'green'}
            style={{ borderRadius: 0, fontWeight: 600 }}
          >
            {isBuhgalter
              ? '📊 Buxgalteriya va UzASBO moduli'
              : isOmborchi
              ? '📦 Ombor va tovarlar zaxirasi'
              : '🏛 Asosiy vositalar va talabnomalar'}
          </Tag>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
            borderBottom: '1px solid var(--color-border-2)',
            paddingBottom: 10,
          }}
        >
          <Space size={8}>
            <Tag
              color={isBuhgalter ? 'magenta' : isOmborchi ? 'arcoblue' : 'green'}
              style={{ borderRadius: 0, fontWeight: 600, fontSize: 13, padding: '4px 10px' }}
            >
              {isBuhgalter
                ? '📊 Buxgalteriya va UzASBO moduli'
                : isOmborchi
                ? '📦 Bosh Omborxona va Tovar Zaxirasi moduli'
                : '🏛 Kafedra, Bo‘lim va Mas’ul Xodimlar (MOL) moduli'}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Tizimdagi rolingiz: <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{formatRoleName(user?.role) || 'Mas’ul xodim'}</span>
            </Typography.Text>
          </Space>

          <Tag color="gray" style={{ borderRadius: 0, fontWeight: 500, fontSize: 12 }}>
            {chapters.length} ta amaliy bosqich
          </Tag>
        </div>
      )}

      <Row gutter={[16, 16]}>
        {/* LEFT COLUMN: VIDEO PLAYER */}
        <Col xs={24} lg={16}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              backgroundColor: '#000',
              borderRadius: 0,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <video
              key={videoSrc}
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              onLoadedMetadata={() => {
                if (videoRef.current && videoRef.current.textTracks) {
                  for (let i = 0; i < videoRef.current.textTracks.length; i++) {
                    videoRef.current.textTracks[i].mode = showSubtitles ? 'showing' : 'disabled';
                  }
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{
                width: '100%',
                maxHeight: 'calc(75vh - 120px)',
                display: 'block',
                backgroundColor: '#000',
              }}
            >
              <track
                kind="subtitles"
                src={subtitleSrc}
                srcLang="uz"
                label="O‘zbekcha"
              />
              Brauzeringiz HTML5 videoni qo‘llab-quvvatlamaydi.
            </video>
          </div>

          {/* Quick player toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              padding: '8px 12px',
              backgroundColor: 'var(--color-fill-1)',
              border: '1px solid var(--color-border-2)',
            }}
          >
            <Space>
              <Button
                size="small"
                type="primary"
                icon={isPlaying ? <IconPause /> : <IconPlayCircle />}
                onClick={togglePlay}
                style={{ borderRadius: 0 }}
              >
                {isPlaying ? 'Pauza' : 'Ijro'}
              </Button>
              <Text style={{ fontSize: 13, fontWeight: 600 }}>
                {formatSeconds(currentTime)} / {totalDurationStr}
              </Text>
            </Space>

            <Space size="small">
              <Button
                size="mini"
                type={showSubtitles ? 'primary' : 'default'}
                onClick={() => setShowSubtitles(!showSubtitles)}
                style={{ borderRadius: 0, fontWeight: 600 }}
              >
                CC {showSubtitles ? 'Yoqilgan' : 'O‘chiq'}
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>Tezlik:</Text>
              {[1, 1.25, 1.5, 2].map((speed) => (
                <Button
                  key={speed}
                  size="mini"
                  type={playbackSpeed === speed ? 'primary' : 'default'}
                  onClick={() => handleSpeedChange(speed)}
                  style={{ borderRadius: 0 }}
                >
                  {speed}x
                </Button>
              ))}
            </Space>
          </div>

          {/* Current Chapter Info Box */}
          <div
            style={{
              marginTop: 10,
              padding: '10px 14px',
              backgroundColor: 'var(--color-bg-2)',
              border: '1px solid var(--color-border-2)',
              borderLeft: '4px solid #165DFF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Tag color="arcoblue" size="small" style={{ borderRadius: 0, fontWeight: 700 }}>
                {chapters[activeChapterIndex]?.stepCode}
              </Tag>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                Vaqt: {chapters[activeChapterIndex]?.timestamp}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4, color: 'var(--color-text-1)' }}>
              {chapters[activeChapterIndex]?.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2 }}>
              {chapters[activeChapterIndex]?.description}
            </div>
          </div>
        </Col>

        {/* RIGHT COLUMN: CHAPTERS & TIMELINE NAVIGATOR */}
        <Col xs={24} lg={8}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              border: '1px solid var(--color-border-2)',
              backgroundColor: 'var(--color-bg-2)',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--color-border-2)',
                backgroundColor: 'var(--color-fill-1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: 700, fontSize: 13 }}>
                BOB VA BOSQICHLAR ({chapters.length})
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Istalgan joyga sakrash
              </Text>
            </div>

            <div
              style={{
                maxHeight: 'calc(75vh - 70px)',
                overflowY: 'auto',
                padding: '4px 0',
              }}
            >
              {chapters.map((ch, idx) => {
                const isActive = activeChapterIndex === idx;
                return (
                  <div
                    key={ch.id}
                    onClick={() => handleSeekChapter(ch)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border-1)',
                      backgroundColor: isActive ? 'var(--color-primary-light-1)' : 'transparent',
                      borderLeft: isActive ? '3px solid #165DFF' : '3px solid transparent',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <Tag
                      color={isActive ? 'arcoblue' : 'gray'}
                      size="small"
                      style={{
                        borderRadius: 0,
                        fontWeight: 600,
                        fontSize: 11,
                        padding: '0 4px',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {ch.timestamp}
                    </Tag>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#165DFF' : 'var(--color-text-1)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ch.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-3)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ch.description}
                      </div>
                    </div>
                    {isActive && (
                      <IconPlayCircle style={{ color: '#165DFF', fontSize: 14, marginTop: 4 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Col>
      </Row>
    </Modal>
  );
};

export default VideoTutorialModal;
