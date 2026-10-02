import { createStyledWorkbook, addStyledWorksheet } from './excel.util';

describe('excel.util', () => {
  it('createStyledWorkbook default parametrlar bilan to‘g‘ri kitob yaratishi kerak', () => {
    const wb = createStyledWorkbook();
    expect(wb.creator).toBe('UWMS — Universitet Ombor va Aktivlarni Boshqarish Tizimi');
    expect(wb.created).toBeInstanceOf(Date);
  });

  it('addStyledWorksheet korporativ sarlavha, chegaralar va ustun kengliklarini to‘g‘ri shakllantirishi kerak', async () => {
    const wb = createStyledWorkbook();
    const data = [
      {
        '№': 1,
        'Inventar №': 'INV-2026-001',
        'Nomi': 'Kompyuter Monoblok HP 24',
        'Qiymati (so‘m)': 8500000,
        'Holati': 'ACTIVE',
      },
      {
        '№': 'Jami',
        'Inventar №': '1 ta aktiv',
        'Nomi': 'JAMI ASOSIY VOSITALAR',
        'Qiymati (so‘m)': 8500000,
        'Holati': '—',
      },
    ];

    const ws = addStyledWorksheet(wb, 'Aktivlar_013', data);
    expect(ws.name).toBe('Aktivlar_013');

    // Header styling
    const headerRow = ws.getRow(1);
    expect(headerRow.height).toBe(28);
    const headerCell = headerRow.getCell(1);
    expect(headerCell.font.bold).toBe(true);
    expect((headerCell.fill as any).fgColor.argb).toBe('FF165DFF');

    // Total row styling
    const totalRow = ws.getRow(3);
    expect(totalRow.height).toBe(24);
    const totalCell = totalRow.getCell(1);
    expect(totalCell.font.bold).toBe(true);
    expect((totalCell.fill as any).fgColor.argb).toBe('FFE8F3FF');

    // Write buffer test
    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('bo‘sh massiv berilganda "Ma’lumot topilmadi" qatorini qo‘shishi kerak', () => {
    const wb = createStyledWorkbook();
    const ws = addStyledWorksheet(wb, 'Bo‘sh', []);
    expect(ws.rowCount).toBe(1);
    expect(ws.getRow(1).getCell(1).value).toBe('Ma’lumot topilmadi');
  });
});
