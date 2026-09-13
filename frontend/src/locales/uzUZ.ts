import enUS from '@arco-design/web-react/es/locale/en-US';
import type { Locale } from '@arco-design/web-react/es/locale/interface';

export const uzUZLocale: Locale = {
  ...enUS,
  ColorPicker: (enUS as any).ColorPicker || {},
  locale: 'uz-UZ',
  Empty: {
    noData: 'Ma’lumot topilmadi',
  },
  Modal: {
    okText: 'Tasdiqlash',
    cancelText: 'Bekor qilish',
  },
  Drawer: {
    okText: 'Tasdiqlash',
    cancelText: 'Bekor qilish',
  },
  Popconfirm: {
    okText: 'Ha',
    cancelText: 'Yo‘q',
  },
  Pagination: {
    goto: 'O‘tish',
    page: 'Sahifa',
    countPerPage: ' / sahifa',
    total: 'Jami: {0} ta',
    prev: 'Oldingi sahifa',
    next: 'Keyingi sahifa',
    currentPage: '{0}-sahifa',
    prevSomePages: 'Oldingi {0} sahifa',
    nextSomePages: 'Keyingi {0} sahifa',
    pageSize: 'sahifa hajmi',
  },
  Table: {
    okText: 'Tasdiqlash',
    resetText: 'Tozalash',
    sortAscend: 'O‘sish bo‘yicha',
    sortDescend: 'Kamayish bo‘yicha',
    cancelSort: 'Saralashni bekor qilish',
  },
};

export default uzUZLocale;
