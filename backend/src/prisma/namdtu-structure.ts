/**
 * Namangan Davlat Texnika Universiteti (NamDTU)
 * Rasmiy tashkiliy tuzilmasi (Fakultetlar, Kafedralar, Markazlar, Bo'limlar)
 */

export interface FacultyData {
  code: string;
  name: string;
  shortName: string;
  externalUuid?: string;
}

export interface ChairData {
  code: string;
  name: string;
  facultyCode: string;
  externalUuid?: string;
}

export interface CenterData {
  code: string;
  name: string;
  type: 'DIVISION' | 'LIBRARY';
  externalUuid?: string;
}

export interface AdministrativeDepartmentData {
  code: string;
  name: string;
  type: 'DEPARTMENT' | 'DIVISION' | 'RECTORATE';
  externalUuid?: string;
}

// 1. FAKULTETLAR (8 ta)
export const NAMDTU_FACULTIES: FacultyData[] = [
  {
    code: 'FAC_ARXITEKTURA_QURILISH',
    name: 'Arxitektura va qurilish fakulteti',
    shortName: 'Arxitektura va qurilish',
    externalUuid: '3efc180e-568b-433f-b3e0-5785b059facc',
  },
  {
    code: 'FAC_YASHIL_TRANSFORMATSIYA',
    name: 'Yashil transformatsiya va texnologiya fakulteti',
    shortName: 'Yashil transformatsiya va texnologiya',
    externalUuid: '03ee756e-e431-4981-8184-3bf067529e49',
  },
  {
    code: 'FAC_MEXANIKA_YENGIL_SANOAT',
    name: 'Mexanika va yengil sanoat muhandisligi fakulteti',
    shortName: 'Mexanika va yengil sanoat muhandisligi',
    externalUuid: 'f2dabe43-356b-42f0-80a5-d2e130e43fdc',
  },
  {
    code: 'FAC_BIZNESNI_BOSHQARISH',
    name: 'Biznesni boshqarish fakulteti',
    shortName: 'Biznesni boshqarish',
    externalUuid: 'bda2a6b5-037c-4d11-8724-c1045387d42c',
  },
  {
    code: 'FAC_IQTISODIYOT',
    name: 'Iqtisodiyot fakulteti',
    shortName: 'Iqtisodiyot',
    externalUuid: '9a52f521-6dbe-465e-9e0e-db615a3d159b',
  },
  {
    code: 'FAC_TRANSPORT_LOGISTIKA',
    name: 'Transport va logistika fakulteti',
    shortName: 'Transport va logistika',
    externalUuid: '7fa46c89-123e-4a72-82e6-41f3cf4ea54a',
  },
  {
    code: 'FAC_ENERGETIKA_MUHANDISLIGI',
    name: 'Energetika muhandisligi fakulteti',
    shortName: 'Energetika muhandisligi',
    externalUuid: 'd51bf85f-c0c3-41ff-a207-8d34b931a8c1',
  },
  {
    code: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    name: "Axborot texnologiyalari va sun'iy intelekt fakulteti",
    shortName: "Axborot texnologiyalari va sun'iy intelekt",
    externalUuid: 'b4eaa444-1720-420b-a1fc-34b3bf3021f5',
  },
];

// 2. KAFEDRALAR (36 ta - har biri tegishli fakultetiga bog'langan)
export const NAMDTU_CHAIRS: ChairData[] = [
  // --- Arxitektura va qurilish fakulteti ---
  {
    code: 'KAF_BINO_VA_INSHOOTLAR_QURILISHI',
    name: 'Bino va inshootlar qurilishi kafedrasi',
    facultyCode: 'FAC_ARXITEKTURA_QURILISH',
    externalUuid: 'd6cea8dd-151f-47dc-bb9a-dd743582b9b0',
  },
  {
    code: 'KAF_QURILISH_MUHANDISLIGI',
    name: 'Qurilish muhandisligi kafedrasi',
    facultyCode: 'FAC_ARXITEKTURA_QURILISH',
    externalUuid: 'a6564cc5-0a69-47b7-b6a6-d697d072ec62',
  },
  {
    code: 'KAF_MUHANDISLIK_KOMMUNIKATSIYALARI_QURILISHI_VA_MONTAJI',
    name: 'Muhandislik kommunikatsiyalari qurilishi va montaji kafedrasi',
    facultyCode: 'FAC_ARXITEKTURA_QURILISH',
    externalUuid: '4071383c-e245-4b23-9037-6860c2f39150',
  },
  {
    code: 'KAF_DIZAYN',
    name: 'Dizayn kafedrasi',
    facultyCode: 'FAC_ARXITEKTURA_QURILISH',
    externalUuid: '3811bef5-e3d4-4432-8b38-6ce0a7d5dfba',
  },
  {
    code: 'KAF_OZBEK_TILI_VA_ADABIYOTI',
    name: 'O‘zbek tili va adabiyoti kafedrasi',
    facultyCode: 'FAC_ARXITEKTURA_QURILISH',
    externalUuid: '9a093eef-49fa-47ae-bff8-34ba8e82080e',
  },

  // --- Yashil transformatsiya va texnologiya fakulteti ---
  {
    code: 'KAF_KIMYO_MUHANDISLIGI',
    name: 'Kimyo muhandisligi kafedrasi',
    facultyCode: 'FAC_YASHIL_TRANSFORMATSIYA',
    externalUuid: 'a728c451-0d64-49b8-9c74-057d2bc7c4a1',
  },
  {
    code: 'KAF_QISHLOQ_XOJALIGI_MUHANDISLIGI',
    name: 'Qishloq xo‘jaligi muhandisligi kafedrasi',
    facultyCode: 'FAC_YASHIL_TRANSFORMATSIYA',
    externalUuid: '44bef011-26b1-4afd-9bde-49c12e55920f',
  },
  {
    code: 'KAF_OZIQ_OVQAT_TEXNOLOGIYASI',
    name: 'Oziq-ovqat texnologiyasi kafedrasi',
    facultyCode: 'FAC_YASHIL_TRANSFORMATSIYA',
    externalUuid: 'b53ef3e0-7cd6-4e2e-b1c0-9d7d0b55bf5d',
  },
  {
    code: 'KAF_KIMYO',
    name: 'Kimyo kafedrasi',
    facultyCode: 'FAC_YASHIL_TRANSFORMATSIYA',
    externalUuid: 'e28e1c2e-9f45-466d-b01b-bf270d5ce4a6',
  },

  // --- Mexanika va yengil sanoat muhandisligi fakulteti ---
  {
    code: 'KAF_MEXANIKA',
    name: 'Mexanika kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: '3500e968-27f1-434f-8cce-67f06a72a89c',
  },
  {
    code: 'KAF_MEXANIKA_MUHANDISLIGI',
    name: 'Mexanika muhandisligi kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: '92089d64-1a44-482d-8e4e-130a1987b805',
  },
  {
    code: 'KAF_TEXNOLOGIK_JARAYONLARNI_AVTOMATLASHTIRISH',
    name: 'Texnologik jarayonlarni avtomatlashtirish kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: 'd2066b68-5e11-4932-b5b1-1d922ccf0b12',
  },
  {
    code: 'KAF_TEXNOLOGIK_MASHINALAR_VA_JIHOZLAR',
    name: 'Texnologik mashinalar va jihozlar kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: 'c9df17a0-0059-41a6-bb19-5fee5c82e200',
  },
  {
    code: 'KAF_TOQIMACHILIK_SANOATI_TEXNOLOGIYASI',
    name: 'To‘qimachilik sanoati texnologiyasi kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: 'cc1b4a47-79a4-40eb-a1f9-2950d4f78307',
  },
  {
    code: 'KAF_YENGIL_SANOAT_MUHANDISLIGI',
    name: 'Yengil sanoat muhandisligi kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: 'd7c0bc1c-8513-4db5-9bc4-358c3463e421',
  },
  {
    code: 'KAF_METROLOGIYA_VA_STANDARTLASHTIRISH',
    name: 'Metrologiya va standartlashtirish kafedrasi',
    facultyCode: 'FAC_MEXANIKA_YENGIL_SANOAT',
    externalUuid: '6e808061-14f5-4f8c-97da-72e92a6c051a',
  },

  // --- Biznesni boshqarish fakulteti ---
  {
    code: 'KAF_MENEJMENT',
    name: 'Menejment kafedrasi',
    facultyCode: 'FAC_BIZNESNI_BOSHQARISH',
    externalUuid: 'c052fbb9-21b7-44ca-8482-55173cf7c48f',
  },
  {
    code: 'KAF_BUXGALTERIYA_HISOBI',
    name: 'Buxgalteriya hisobi kafedrasi',
    facultyCode: 'FAC_BIZNESNI_BOSHQARISH',
    externalUuid: 'd104c86d-600d-471b-a577-b6191e44a0a6',
  },
  {
    code: 'KAF_IJTIMOIY_FANLAR',
    name: 'Ijtimoiy fanlar kafedrasi',
    facultyCode: 'FAC_BIZNESNI_BOSHQARISH',
    externalUuid: '778b50de-779e-4d13-9d15-aabe9689b407',
  },
  {
    code: 'KAF_JISMONIY_MADANIYAT_VA_SPORT',
    name: 'Jismoniy madaniyat va sport kafedrasi',
    facultyCode: 'FAC_BIZNESNI_BOSHQARISH',
    externalUuid: 'edcc126d-6451-4221-a32b-d9a47eeafa45',
  },

  // --- Iqtisodiyot fakulteti ---
  {
    code: 'KAF_IQTISODIYOT',
    name: 'Iqtisodiyot kafedrasi',
    facultyCode: 'FAC_IQTISODIYOT',
    externalUuid: '169049d6-e8d0-4492-9f31-2d4bdd4528d2',
  },
  {
    code: 'KAF_IQTISODIYOT_NAZARIYASI',
    name: 'Iqtisodiyot nazariyasi kafedrasi',
    facultyCode: 'FAC_IQTISODIYOT',
    externalUuid: 'b2e2b8d2-6840-4c53-989c-20ff83d8095a',
  },
  {
    code: 'KAF_MARKETING',
    name: 'Marketing kafedrasi',
    facultyCode: 'FAC_IQTISODIYOT',
    externalUuid: '86684d2b-a09f-4381-914e-c37ee289d72d',
  },
  {
    code: 'KAF_XORIJIY_TILLAR',
    name: 'Xorijiy tillar kafedrasi',
    facultyCode: 'FAC_IQTISODIYOT',
    externalUuid: '55ff1ae7-15b9-4ca7-8016-217ac6241fed',
  },

  // --- Transport va logistika fakulteti ---
  {
    code: 'KAF_AVTOMOBIL_YOLLARI',
    name: 'Avtomobil yo‘llari kafedrasi',
    facultyCode: 'FAC_TRANSPORT_LOGISTIKA',
    externalUuid: '4e728703-c030-4dcc-bb36-130d624344ac',
  },
  {
    code: 'KAF_YOL_HARAKATI_XAVFSIZLIGI',
    name: 'Yo‘l harakati xavfsizligi kafedrasi',
    facultyCode: 'FAC_TRANSPORT_LOGISTIKA',
    externalUuid: 'e85593e7-f6ff-4670-a99b-80b6c7f190d4',
  },
  {
    code: 'KAF_TRANSPORT_MUHANDISLIGI',
    name: 'Transport muhandisligi kafedrasi',
    facultyCode: 'FAC_TRANSPORT_LOGISTIKA',
    externalUuid: '768c2f80-aafe-4e05-9633-08880bdca474',
  },
  {
    code: 'KAF_LOGISTIKA',
    name: 'Logistika kafedrasi',
    facultyCode: 'FAC_TRANSPORT_LOGISTIKA',
    externalUuid: '55748052-71e5-458d-b95c-de699c319b3c',
  },

  // --- Energetika muhandisligi fakulteti ---
  {
    code: 'KAF_ENERGETIKA_MUHANDISLIGI',
    name: 'Energetika muhandisligi kafedrasi',
    facultyCode: 'FAC_ENERGETIKA_MUHANDISLIGI',
    externalUuid: '7e9910fb-d1f9-47a8-9d2c-e6d4b4db20b8',
  },
  {
    code: 'KAF_ELEKTROTEXNIKA_VA_ELEKTRONIKA',
    name: 'Elektrotexnika va elektronika kafedrasi',
    facultyCode: 'FAC_ENERGETIKA_MUHANDISLIGI',
    externalUuid: '932e3813-080a-4048-8423-197e5db139e4',
  },
  {
    code: 'KAF_MEHNAT_MUHOFAZASI_VA_EKOLOGIYA',
    name: 'Mehnat muhofazasi va ekologiya kafedrasi',
    facultyCode: 'FAC_ENERGETIKA_MUHANDISLIGI',
    externalUuid: 'fb7f29f5-0003-4139-9ee7-cdeaef512a65',
  },
  {
    code: 'KAF_FIZIKA',
    name: 'Fizika kafedrasi',
    facultyCode: 'FAC_ENERGETIKA_MUHANDISLIGI',
    externalUuid: '4fdaad60-c317-4097-830f-bca761095313',
  },

  // --- Axborot texnologiyalari va sun'iy intelekt fakulteti ---
  {
    code: 'KAF_AXBOROT_TIZIMLARI_VA_TEXNOLOGIYALARI',
    name: 'Axborot tizimlari va texnologiyalari kafedrasi',
    facultyCode: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    externalUuid: 'f102938a-ba80-4329-b07c-7b81fd87c337',
  },
  {
    code: 'KAF_RAQAMLAR_TEXNOLOGIYALAR',
    name: 'Raqamlar texnologiyalar kafedrasi',
    facultyCode: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    externalUuid: '1dc4b0a7-1e84-460f-8755-5dbe1801aef6',
  },
  {
    code: 'KAF_OLIY_MATEMATIKA',
    name: 'Oliy matematika kafedrasi',
    facultyCode: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    externalUuid: '8a757f58-e70e-44b5-9827-c9f50a6f7ea5',
  },
  {
    code: 'KAF_CHIZMA_GEOMETRIYA_GRAFIKA',
    name: 'Chizma geometriya va muhandislik kompyuter grafikasi kafedrasi',
    facultyCode: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    externalUuid: '50230fad-a7cc-4aad-9ab1-d5738e30a5e6',
  },
];

// 3. MARKAZLAR (4 ta)
export const NAMDTU_CENTERS: CenterData[] = [
  {
    code: 'MARKAZ_KARYERA_VA_BANDLIK',
    name: 'Kar’yera va bandlik markazi',
    type: 'DIVISION',
    externalUuid: 'ad0c38a0-fb99-43cc-a57a-5884d14556b0',
  },
  {
    code: 'MARKAZ_AXBOROT_RESURS',
    name: 'Axborot resurs markazi',
    type: 'LIBRARY',
    externalUuid: 'd49b91d2-ce94-4675-8d3b-94847ecd4470',
  },
  {
    code: 'MARKAZ_RAQAMLI_TALIM_TEXNOLOGIYALARI',
    name: "Raqamli ta'lim texnologiyalari markazi",
    type: 'DIVISION',
    externalUuid: '43bbdbf7-a064-4311-9032-c105f0dd2b3e',
  },
  {
    code: 'MARKAZ_TEXNOLOGIYALAR_VA_INNOVATSIYALARNI_QOLLAB_QUVVATLASH',
    name: 'Texnologiyalar va innovatsiyalarni qo‘llab-quvvatlash markazi',
    type: 'DIVISION',
    externalUuid: 'bffa50b0-6ad9-4101-8850-e3b2a9c0c344',
  },
];

// 4. MA'MURIY BO'LIMLAR VA BOSHQARMALAR (21 ta)
export const NAMDTU_ADMIN_DEPARTMENTS: AdministrativeDepartmentData[] = [
  {
    code: 'REKTORAT',
    name: 'Universitet Rektorati va Rahbariyat',
    type: 'RECTORATE',
  },
  {
    code: 'BOLIM_XOJALIK',
    name: 'Xo‘jalik Bo‘limi va Komendantlik',
    type: 'DEPARTMENT',
  },
  {
    code: 'BOLIM_BUXGALTERIYA',
    name: "Buxgalteriya bo'limi",
    type: 'DEPARTMENT',
    externalUuid: '36d31ab7-91a2-4b30-ae91-e78bccaf4006',
  },
  {
    code: 'BOLIM_TALABALAR_AMALIYOTI',
    name: "Talabalar amaliyoti bo'limi",
    type: 'DEPARTMENT',
    externalUuid: '03c6ec20-40ee-482d-af86-59602f3f113e',
  },
  {
    code: 'BOLIM_KOMPLAENS_NAZORAT',
    name: 'Korrupsiyaga qarshi kurashish ‘komplaens nazorat’ tizimini boshqarish bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: '98287c54-4aa1-41d9-8d8f-c774c1767dcd',
  },
  {
    code: 'BOLIM_MUROJAATLAR_MONITORING',
    name: 'Jismoniy va yuridik shaxslarning murojaatlari bilan ishlash, nazorat va monitoring bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: '3b2652bc-b6f9-4f4d-8b97-9a08c729eb87',
  },
  {
    code: 'BOLIM_XODIMLAR',
    name: 'Xodimlar bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: '763a813a-ea2c-41a7-8518-914d2d9fc993',
  },
  {
    code: 'BOLIM_YURISKONSULT',
    name: "Yuriskonsult bo'limi",
    type: 'DEPARTMENT',
    externalUuid: 'cea1a585-aca8-41c7-8b61-e854f46751d6',
  },
  {
    code: 'BOLIM_TALIM_SIFATI_NAZORATI',
    name: 'Ta’lim sifati nazorati bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: 'dfa6d739-5740-4d71-97a7-09b6329859b1',
  },
  {
    code: 'BOLIM_ENERGETIKA_XOJALIGI',
    name: "Energetika xo'jaligi bo'limi",
    type: 'DEPARTMENT',
    externalUuid: 'c8877c75-f5d9-42e7-ab0e-aeed03aeb420',
  },
  {
    code: 'BOLIM_REJA_MOLIYA',
    name: "Reja moliya bo'limi",
    type: 'DEPARTMENT',
    externalUuid: '0651ca2d-5d7c-46d3-9b8b-f7cdc5991836',
  },
  {
    code: 'BOLIM_OQITISHNING_TEXNIK_VOSITALARI',
    name: "O'qitishning texnik vositalari bo'limi",
    type: 'DEPARTMENT',
    externalUuid: '48e4e939-0dbd-4ca9-baa0-17c808243912',
  },
  {
    code: 'BOLIM_FUQARO_VA_MEHNAT_MUHOFAZASI',
    name: 'Fuqaro va mehnat muhofazasi bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: 'a7ee7007-28fc-4180-9c91-fec8dfeb7177',
  },
  {
    code: 'BOLIM_XALQARO_HAMKORLIK',
    name: 'Xalqaro hamkorlik bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: 'ceea94db-d1a3-483a-8f4c-a16813c177a5',
  },
  {
    code: 'BOLIM_MAGISTRATURA',
    name: 'Magistratura bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: '2e042e91-f8c9-4c25-a23d-eb739ecdc446',
  },
  {
    code: 'BOLIM_IQTIDORLI_TALABALAR',
    name: 'Iqtidorli talabalarning ilmiy-tadqiqot faoliyatini tashkil etish bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: '62656f58-c7d5-4fe9-9f90-6dcdbf233e65',
  },
  {
    code: 'BOLIM_ILMIY_TADQIQOTLAR',
    name: 'Ilmiy tadqiqotlar, innovatsiyalar va ilmiy-pedagogik kadrlar tayyorlash bo’limi',
    type: 'DEPARTMENT',
    externalUuid: '0a240b16-f90b-480c-bb64-b164550bf95e',
  },
  {
    code: 'BOLIM_YOSHLAR_MANAVIYAT',
    name: 'Yoshlar bilan ishlash, ma’naviyat va ma’rifat bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: '30a98cac-3d9a-4640-bb1b-266f60c55502',
  },
  {
    code: 'BOLIM_DEVOXNXONA',
    name: 'Devoxnxona bo‘limi',
    type: 'DEPARTMENT',
    externalUuid: 'd44d8c08-88bb-4e10-ba62-683575f49b92',
  },
  {
    code: 'BOLIM_REGISTRATOR_OFISI',
    name: 'Registrator ofisi',
    type: 'DEPARTMENT',
    externalUuid: '011ac5b7-b13e-41b0-aba9-3e746783c22d',
  },
  {
    code: 'BOSHQARMA_OQUV_USLUBIY',
    name: 'O‘quv - uslubiy boshqarma',
    type: 'DIVISION',
    externalUuid: 'cbb19a19-94d5-4047-811e-57d089a8cbe5',
  },
];
