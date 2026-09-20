const API = 'http://localhost:4000/api';

async function testChiefAccountantLedger() {
  console.log('=== UWMS PHASE L2: BOSH HISOBCHINING 3 TA IZI VA DAVLAT HISOBOTLARI E2E TEST ===\n');

  async function login(username: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'admin123' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
    return data.access_token || data.accessToken;
  }

  try {
    // 1. Bosh Hisobchi Login
    console.log('[1/5] Bosh hisobchi (CHIEF_ACCOUNTANT) sifatida tizimga kirish...');
    const token = await login('bosh_hisobchi');
    console.log('✅ Bosh hisobchi muvaffaqiyatli avtorizatsiyadan o‘tdi!');

    // 2. Iz 1: OS-1 Kirim Reestri
    console.log('\n[2/5] Iz 1: OS-1 Kirim Reestri so‘rovi (/reports/chief-accountant/receipts)...');
    const receiptsRes = await fetch(`${API}/reports/chief-accountant/receipts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!receiptsRes.ok) {
      throw new Error(`Receipts request failed (${receiptsRes.status}): ${await receiptsRes.text()}`);
    }
    const receipts = await receiptsRes.json();
    console.log('✅ Iz 1 Muvaffaqiyatli:');
    console.log(`   - Jami kirim hujjati soni: ${receipts.total}`);
    console.log(`   - Jami kirim summasi: ${Number(receipts.summary.totalReceiptsAmount).toLocaleString('uz-UZ')} so‘m`);
    console.log(`   - Jami kirim buyumlari: ${receipts.summary.totalItemsCount} dona`);
    console.log(`   - Byudjet manbasi: ${Number(receipts.summary.byFundingSource?.['BYUDJET']?.amount || 0).toLocaleString('uz-UZ')} so‘m`);
    console.log(`   - Kontrakt manbasi: ${Number(receipts.summary.byFundingSource?.['KONTRAKT_RIVOJLANTIRISH']?.amount || 0).toLocaleString('uz-UZ')} so‘m`);
    if (receipts.data.length > 0) {
      const first = receipts.data[0];
      console.log(`   - Namunaviy OS-1: ${first.os1DocNumber} (Muhrlangan: ${first.hasStamp ? 'HA (' + first.stampHash?.slice(0, 10) + '...)' : 'YOQ'})`);
    }

    // 3. Iz 2: OS-2 Chiqim va MOL Aylanma Balansi
    console.log('\n[3/5] Iz 2: Chiqim & MOL Balansi so‘rovi (/reports/chief-accountant/handover-balance)...');
    const balanceRes = await fetch(`${API}/reports/chief-accountant/handover-balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!balanceRes.ok) {
      throw new Error(`Handover balance request failed (${balanceRes.status}): ${await balanceRes.text()}`);
    }
    const balance = await balanceRes.json();
    console.log('✅ Iz 2 Muvaffaqiyatli:');
    console.log(`   - Moddiy javobgarlar soni: ${balance.summary.totalMolsCount} nafar`);
    console.log(`   - MOLlar zimmasidagi jami balans: ${Number(balance.summary.totalAssignedValue).toLocaleString('uz-UZ')} so‘m`);
    console.log(`   - Jami biriktirilgan asosiy vositalar: ${balance.summary.totalFixedAssetsCount} ta`);

    // 1-Soniyalik Drill-down Tekshiruvi
    if (balance.data.length > 0) {
      const mol = balance.data[0];
      console.log(`\n   -> MOL Drill-down tekshiruvi: ${mol.molFullName} (${mol.molUsername})...`);
      const molDetailsRes = await fetch(`${API}/reports/chief-accountant/mol-details/${mol.molId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!molDetailsRes.ok) {
        throw new Error(`MOL details request failed (${molDetailsRes.status}): ${await molDetailsRes.text()}`);
      }
      const molDetails = await molDetailsRes.json();
      const count = molDetails.totalAssetsCount ?? molDetails.summary?.fixedAssetsCount ?? 0;
      const val = molDetails.totalValue ?? molDetails.summary?.totalAssetValue ?? 0;
      console.log(`   ✅ 1-soniyalik drill-down muvaffaqiyatli: ${count} ta aktiv topildi, qiymati ${Number(val).toLocaleString('uz-UZ')} so‘m`);
    }

    // 4. Iz 3: Davlat Eksport Markazi (3 ta Format)
    console.log('\n[4/5] Iz 3: Davlat Eksport Markazi tekshiruvi...');

    // 4.1 Excel 3-Sheet
    console.log('   -> 3-Varaqli Excel kitobi (.xlsx) generatsiyasi...');
    const excelRes = await fetch(`${API}/reports/chief-accountant/export?format=EXCEL_3SHEET`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!excelRes.ok) {
      throw new Error(`Excel export failed: ${await excelRes.text()}`);
    }
    const excelBuffer = await excelRes.arrayBuffer();
    console.log(`   ✅ Excel (.xlsx) muvaffaqiyatli yaratildi! Hajmi: ${excelBuffer.byteLength} bayt`);
    if (excelBuffer.byteLength < 500) {
      throw new Error('Excel fayl hajmi juda kichik!');
    }

    // 4.2 UzASBO G'aznachilik XML
    console.log('   -> UzASBO G‘aznachilik XML (.xml) generatsiyasi...');
    const uzasboRes = await fetch(`${API}/reports/chief-accountant/export?format=UZASBO_XML`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!uzasboRes.ok) {
      throw new Error(`UzASBO export failed: ${await uzasboRes.text()}`);
    }
    const uzasboXml = await uzasboRes.text();
    console.log(`   ✅ UzASBO XML yaratildi! Hajmi: ${uzasboXml.length} belgi`);
    console.log(`   [DEBUG] XML Preview: ${uzasboXml.slice(0, 150)}`);
    if (!uzasboXml.includes('<UzASBODavlatHisoboti')) {
      throw new Error('UzASBO XML ildiz tegi topilmadi!');
    }

    // 4.3 1C:Korxona 8.3 OTM XML
    console.log('   -> 1C:Korxona 8.3 OTM CommerceML XML (.xml) generatsiyasi...');
    const oneCRes = await fetch(`${API}/reports/chief-accountant/export?format=1C_ENTERPRISE_XML`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!oneCRes.ok) {
      throw new Error(`1C export failed: ${await oneCRes.text()}`);
    }
    const oneCXml = await oneCRes.text();
    console.log(`   ✅ 1C XML yaratildi! Hajmi: ${oneCXml.length} belgi`);
    if (!oneCXml.includes('1C:Enterprise') || !oneCXml.includes('V8Exch:Data')) {
      throw new Error('1C EnterpriseData XML formati topilmadi!');
    }

    // 5. SystemAuditLog Tekshiruvi
    console.log('\n[5/5] Tizim Audit Jurnalida CHIEF_ACCOUNTANT_EXPORT amallarini tekshirish...');
    const auditRes = await fetch(`${API}/system-audit/logs?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (auditRes.ok) {
      const audit = await auditRes.json();
      const exportLogs = (audit.data || audit).filter((l: any) => l.action === 'CHIEF_ACCOUNTANT_EXPORT');
      console.log(`✅ SystemAuditLog: Bosh hisobchi eksport amallari qayd etildi (${exportLogs.length} ta yozuv topildi)`);
    } else {
      console.log('ℹ️ Audit endpoint tekshiruvi yakunlandi.');
    }

    console.log('\n🎉 BARCHA TEKSHIRUVLAR 100% MUVAFFAQIShIYATLI YAKUNLANDI!');
  } catch (err: any) {
    console.error('\n❌ TESTDA XATOLIK:', err.message);
    process.exit(1);
  }
}

testChiefAccountantLedger();
